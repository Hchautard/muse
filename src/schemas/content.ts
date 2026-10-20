// Content schemas shared by the app (to validate fetched JSON) and the content scripts.
import { z } from 'zod'
import { isAllowedLicense } from './licenses'

export const COURSE_IDS = ['music', 'art'] as const
export const ENTITY_TYPES = [
  'work',
  'person',
  'movement',
  'period',
  'concept',
  'instrument',
] as const
export const RELATION_TYPES = [
  'createdBy',
  'belongsTo',
  'inPeriod',
  'influencedBy',
  'features',
] as const
export const SKILLS = [
  'audio-to-composer',
  'audio-to-period',
  'image-to-artist',
  'image-to-movement',
  'work-to-date',
  'concept-definition',
] as const

export const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'identifiant attendu en minuscules, chiffres et tirets')
export const courseIdSchema = z.enum(COURSE_IDS)
export const skillSchema = z.enum(SKILLS)
const yearSchema = z.number().int().min(-3000).max(2100)

export const entitySchema = z.object({
  id: idSchema,
  type: z.enum(ENTITY_TYPES),
  name: z.string().min(1),
  wikidataId: z
    .string()
    .regex(/^Q\d+$/)
    .optional(),
  /** Works: year of creation (approximate is fine). */
  year: yearSchema.optional(),
  /** People: birth; periods: start. */
  yearStart: yearSchema.optional(),
  /** People: death; periods: end. */
  yearEnd: yearSchema.optional(),
  summary: z.string().min(1).max(600),
  mediaIds: z.array(idSchema),
  tags: z.array(z.string().min(1)).optional(),
  /** Works: holding institution (Wikidata P195). */
  collection: z.string().min(1).optional(),
})

export const relationSchema = z.object({
  from: idSchema,
  type: z.enum(RELATION_TYPES),
  to: idSchema,
})

const mediaPathSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9/._-]*$/, 'chemin relatif à public/media attendu')

export const mediaAssetSchema = z.object({
  id: idSchema,
  kind: z.enum(['image', 'audio']),
  /** Relative to public/media. */
  src: mediaPathSchema,
  bytes: z.number().int().nonnegative(),
  /** Images: size of `src`, for layout before load. */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** Images: 480, 960 and 1600 px wide when the original is large enough. */
  variants: z
    .array(
      z.object({
        width: z.number().int().positive(),
        src: mediaPathSchema,
        bytes: z.number().int().nonnegative(),
      }),
    )
    .optional(),
  durationSec: z.number().positive().optional(),
  credit: z.string().min(1),
  license: z.string().refine(isAllowedLicense, { message: 'licence non autorisée' }),
  sourceUrl: z.url(),
})

export const lessonSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  introduces: z.array(idSchema).min(3, 'une leçon doit introduire au moins 3 entités'),
  skills: z.array(skillSchema).min(1),
})

export const unitSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  lessons: z.array(lessonSchema).min(1),
})

export const courseSchema = z.object({
  id: courseIdSchema,
  title: z.string().min(1),
  units: z.array(unitSchema),
})

/** One generated file per course: public/content/<course>.json */
export const courseBundleSchema = courseSchema.extend({
  version: z.string().min(1),
  entities: z.array(entitySchema),
  relations: z.array(relationSchema),
  media: z.array(mediaAssetSchema),
})

/** public/content/index.json */
export const contentIndexSchema = z.object({
  schemaVersion: z.literal(1),
  courses: z.array(
    z.object({
      id: courseIdSchema,
      title: z.string(),
      version: z.string(),
      file: z.string(),
      unitCount: z.number().int().nonnegative(),
      lessonCount: z.number().int().nonnegative(),
      entityCount: z.number().int().nonnegative(),
      /** Total size of the course media, for the offline download estimate. */
      mediaBytes: z.number().int().nonnegative(),
    }),
  ),
})

export type CourseId = z.infer<typeof courseIdSchema>
export type EntityType = (typeof ENTITY_TYPES)[number]
export type RelationType = (typeof RELATION_TYPES)[number]
export type Skill = z.infer<typeof skillSchema>
export type Entity = z.infer<typeof entitySchema>
export type Relation = z.infer<typeof relationSchema>
export type MediaAsset = z.infer<typeof mediaAssetSchema>
export type Lesson = z.infer<typeof lessonSchema>
export type Unit = z.infer<typeof unitSchema>
export type Course = z.infer<typeof courseSchema>
export type CourseBundle = z.infer<typeof courseBundleSchema>
export type ContentIndex = z.infer<typeof contentIndexSchema>
