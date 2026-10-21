// Validates content/ and the media registry, then writes public/content/index.json and one
// <course>.json bundle per course. Nothing is written if any check fails.
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import {
  courseBundleSchema,
  RELATION_TYPES,
  type ContentIndex,
  type CourseBundle,
  type Entity,
  type Relation,
} from '../src/schemas/content'
import {
  ContentError,
  loadCourseFiles,
  loadEntityFiles,
  loadRegistry,
  PATHS,
  rel,
  runScript,
  validate,
  writeJson,
} from './lib/content-files'
import { frenchSpacing } from './lib/typography'
import { validateCourseBundle } from './lib/validate-content'

const asList = (value: string | string[] | undefined) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value]

runScript(async () => {
  const [courseFiles, entityFiles, registry] = await Promise.all([
    loadCourseFiles(),
    loadEntityFiles(),
    loadRegistry(),
  ])
  const errors: string[] = []
  const warnings: string[] = []

  const sources = entityFiles.flatMap(({ file, data }) =>
    data.entities.map((entity) => ({ entity, course: data.course, file })),
  )
  const firstFile = new Map<string, string>()
  for (const { entity, file } of sources) {
    const previous = firstFile.get(entity.id)
    if (previous)
      errors.push(`Entité « ${entity.id} » définie deux fois (${rel(previous)}, ${rel(file)})`)
    else firstFile.set(entity.id, file)
  }

  const bundles: CourseBundle[] = []
  for (const { file: courseFile, data: course } of courseFiles) {
    const assets = registry.assets.filter((a) => a.course === course.id)
    const entities: Entity[] = []
    const relations: Relation[] = []

    for (const { entity, file } of sources.filter((s) => s.course === course.id)) {
      const where = `${rel(file)}, « ${entity.id} »`
      if (!entity.name) errors.push(`${where} : nom manquant`)
      if (!entity.summary) errors.push(`${where} : résumé manquant`)
      for (const type of RELATION_TYPES)
        for (const to of asList(entity.relations?.[type]))
          relations.push({ from: entity.id, type, to })
      // Fixed key order keeps the generated JSON stable and readable.
      entities.push({
        id: entity.id,
        type: entity.type,
        name: frenchSpacing(entity.name ?? ''),
        wikidataId: entity.wikidataId,
        year: entity.year,
        yearStart: entity.yearStart,
        yearEnd: entity.yearEnd,
        summary: frenchSpacing(entity.summary ?? ''),
        mediaIds: assets.filter((a) => a.entityId === entity.id).map((a) => a.id),
        tags: entity.tags,
        collection: entity.collection,
      })
    }

    const media = assets.map(
      ({ course: _course, entityId: _entityId, origin: _origin, ...asset }) => asset,
    )
    const body = {
      id: course.id,
      title: course.title,
      units: course.units,
      entities,
      relations,
      media,
    }
    const version = createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 12)
    const bundle = validate(courseFile, courseBundleSchema, { ...body, version })

    errors.push(
      ...validateCourseBundle(bundle, {
        mediaFileExists: (src) => existsSync(join(PATHS.publicMedia, src)),
      }).map((e) => `[${course.id}] ${e}`),
    )
    const introduced = new Set(bundle.units.flatMap((u) => u.lessons.flatMap((l) => l.introduces)))
    for (const entity of bundle.entities)
      if (!introduced.has(entity.id))
        warnings.push(`[${course.id}] « ${entity.id} » n’est introduite par aucune leçon`)
    bundles.push(bundle)
  }

  for (const warning of warnings) console.warn(`⚠ ${warning}`)
  if (errors.length)
    throw new ContentError(`${errors.length} erreur(s) dans le contenu :\n- ${errors.join('\n- ')}`)

  const index: ContentIndex = { schemaVersion: 1, courses: [] }
  for (const bundle of bundles) {
    const file = `${bundle.id}.json`
    await writeJson(join(PATHS.publicContent, file), bundle)
    const lessons = bundle.units.flatMap((u) => u.lessons)
    index.courses.push({
      id: bundle.id,
      title: bundle.title,
      version: bundle.version,
      file,
      unitCount: bundle.units.length,
      lessonCount: lessons.length,
      entityCount: bundle.entities.length,
      mediaBytes: bundle.media.reduce(
        (sum, m) => sum + (m.variants ? m.variants.reduce((s, v) => s + v.bytes, 0) : m.bytes),
        0,
      ),
    })
    console.log(
      `✓ ${file} — ${lessons.length} leçon(s), ${bundle.entities.length} entités, ${bundle.media.length} médias`,
    )
  }
  await writeJson(join(PATHS.publicContent, 'index.json'), index)

  // Drop bundles of courses that no longer exist.
  const expected = new Set(['index.json', ...index.courses.map((c) => c.file)])
  for (const name of existsSync(PATHS.publicContent) ? await readdir(PATHS.publicContent) : [])
    if (name.endsWith('.json') && !expected.has(name)) await rm(join(PATHS.publicContent, name))

  console.log(`✓ ${rel(join(PATHS.publicContent, 'index.json'))}`)
})
