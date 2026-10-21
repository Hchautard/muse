// Cross-file checks that zod schemas alone cannot express.
import { SKILL_SPECS } from '../../src/engine/skills'
import type { CourseBundle, EntityType, RelationType } from '../../src/schemas/content'

/** Which entity types each relation may point to. */
const RELATION_TARGETS: Record<RelationType, EntityType[]> = {
  createdBy: ['person'],
  belongsTo: ['movement', 'period'],
  inPeriod: ['period'],
  influencedBy: ['person', 'movement', 'work'],
  features: ['instrument', 'concept', 'person'],
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const value of values) (seen.has(value) ? dupes : seen).add(value)
  return [...dupes]
}

export interface ValidationOptions {
  /** Checks that a path relative to public/media exists. */
  mediaFileExists: (src: string) => boolean
}

/** Returns human-readable errors (in French, like the rest of the content tooling). */
export function validateCourseBundle(bundle: CourseBundle, options: ValidationOptions): string[] {
  const errors: string[] = []
  const entities = new Map(bundle.entities.map((e) => [e.id, e]))
  const media = new Map(bundle.media.map((m) => [m.id, m]))

  for (const id of duplicates(bundle.entities.map((e) => e.id)))
    errors.push(`Entité en double : « ${id} »`)
  for (const id of duplicates(bundle.media.map((m) => m.id)))
    errors.push(`Média en double : « ${id} »`)
  for (const id of duplicates(bundle.units.map((u) => u.id)))
    errors.push(`Unité en double : « ${id} »`)
  const lessons = bundle.units.flatMap((u) => u.lessons)
  for (const id of duplicates(lessons.map((l) => l.id))) errors.push(`Leçon en double : « ${id} »`)

  for (const relation of bundle.relations) {
    const label = `Relation ${relation.from} —${relation.type}→ ${relation.to}`
    if (!entities.has(relation.from)) errors.push(`${label} : source inconnue`)
    const target = entities.get(relation.to)
    if (!target) errors.push(`${label} : cible inconnue`)
    else if (!RELATION_TARGETS[relation.type].includes(target.type))
      errors.push(
        `${label} : la cible doit être de type ${RELATION_TARGETS[relation.type].join(' ou ')}`,
      )
  }

  for (const entity of bundle.entities) {
    for (const mediaId of entity.mediaIds)
      if (!media.has(mediaId)) errors.push(`Entité « ${entity.id} » : média inconnu « ${mediaId} »`)
    if (
      entity.type === 'person' &&
      (entity.yearStart === undefined || entity.yearEnd === undefined)
    )
      errors.push(`Personne « ${entity.id} » : dates de naissance et de mort requises`)
    if (
      entity.type === 'period' &&
      (entity.yearStart === undefined || entity.yearEnd === undefined)
    )
      errors.push(`Période « ${entity.id} » : années de début et de fin requises`)
  }

  for (const asset of bundle.media) {
    for (const src of [asset.src, ...(asset.variants ?? []).map((v) => v.src)])
      if (!options.mediaFileExists(src))
        errors.push(`Média « ${asset.id} » : fichier absent public/media/${src}`)
    if (asset.kind === 'audio' && asset.durationSec === undefined)
      errors.push(`Média « ${asset.id} » : durée manquante`)
  }

  const introducedIn = new Map<string, string>()
  for (const lesson of lessons) {
    for (const entityId of lesson.introduces) {
      const entity = entities.get(entityId)
      if (!entity) {
        errors.push(`Leçon « ${lesson.id} » : entité inconnue « ${entityId} »`)
        continue
      }
      const previous = introducedIn.get(entityId)
      if (previous)
        errors.push(
          `Entité « ${entityId} » introduite deux fois (« ${previous} » et « ${lesson.id} »)`,
        )
      introducedIn.set(entityId, lesson.id)

      if (entity.type !== 'work') continue
      for (const skill of lesson.skills) {
        const needs = SKILL_SPECS[skill]
        if (!needs) continue
        const where = `Leçon « ${lesson.id} », œuvre « ${entityId} » (${skill})`
        if (needs.media && !entity.mediaIds.some((id) => media.get(id)?.kind === needs.media))
          errors.push(`${where} : média ${needs.media} manquant`)
        if (
          needs.answer &&
          !bundle.relations.some((r) => r.from === entityId && r.type === needs.answer)
        )
          errors.push(`${where} : relation ${needs.answer} manquante`)
        if (needs.year && entity.year === undefined) errors.push(`${where} : année manquante`)
      }
    }
  }

  return errors
}
