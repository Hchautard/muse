// Completes content/entities/*.yaml from Wikidata without overwriting hand-written values,
// then writes a report of conflicts and missing fields to reports/ingest.md.
import { join } from 'node:path'
import {
  loadEntityFiles,
  PATHS,
  rel,
  runScript,
  stringifyYamlDocument,
  writeText,
} from './lib/content-files'
import { buildFactsQuery, parseFacts, planIngest, type KnownEntity } from './lib/wikidata'
import { sparql } from './lib/wikimedia'

const BATCH_SIZE = 50

runScript(async () => {
  const files = await loadEntityFiles()
  const known = new Map<string, KnownEntity>()
  for (const { data } of files)
    for (const entity of data.entities)
      if (entity.wikidataId) known.set(entity.wikidataId, { id: entity.id, type: entity.type })

  const qids = [...known.keys()]
  console.log(`Wikidata : ${qids.length} entités à interroger…`)
  const rows = []
  for (let i = 0; i < qids.length; i += BATCH_SIZE)
    rows.push(...(await sparql(buildFactsQuery(qids.slice(i, i + BATCH_SIZE)))))
  const facts = parseFacts(rows)

  const report: string[] = ['# Rapport d’ingestion Wikidata', '']
  let filled = 0

  for (const { file, doc, data } of files) {
    const section: string[] = []
    let changed = false
    data.entities.forEach((entity, index) => {
      const lines: string[] = []
      const entityFacts = entity.wikidataId ? facts.get(entity.wikidataId) : undefined

      if (!entity.wikidataId) lines.push('pas d’identifiant Wikidata')
      else if (!entityFacts) lines.push(`${entity.wikidataId} introuvable sur Wikidata`)
      else {
        const plan = planIngest(entity, entityFacts, data.course, known)
        for (const { path, value } of plan.set) {
          doc.setIn(['entities', index, ...path], value)
          lines.push(`complété : ${path.join('.')} = ${JSON.stringify(value)}`)
          changed = true
          filled++
        }
        lines.push(...plan.conflicts.map((c) => `⚠ conflit — ${c}`), ...plan.notes)
      }

      // Fields still missing after ingest (the build will reject some of them).
      const merged = doc.getIn(['entities', index]) as { toJSON(): Record<string, unknown> }
      const after = merged.toJSON()
      const relations = (after.relations ?? {}) as Record<string, unknown>
      if (!after.name) lines.push('✖ nom manquant')
      if (!after.summary) lines.push('✖ résumé manquant')
      if (entity.type === 'work') {
        if (after.year === undefined) lines.push('✖ année manquante')
        if (!relations.createdBy) lines.push('✖ créateur manquant')
      }
      if (
        entity.type === 'person' &&
        (after.yearStart === undefined || after.yearEnd === undefined)
      )
        lines.push('✖ dates de naissance / mort manquantes')

      if (lines.length) section.push(`- **${entity.id}**`, ...lines.map((l) => `  - ${l}`))
    })

    if (changed) await writeText(file, stringifyYamlDocument(doc))
    report.push(`## ${rel(file)}`, '', ...(section.length ? section : ['Rien à signaler.']), '')
  }

  const reportFile = join(PATHS.reports, 'ingest.md')
  await writeText(reportFile, `${report.join('\n')}\n`)
  console.log(report.join('\n'))
  console.log(`\n✓ ${filled} champ(s) complété(s). Rapport : ${rel(reportFile)}`)
})
