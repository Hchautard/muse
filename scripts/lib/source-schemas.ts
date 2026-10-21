// Schemas of the hand-edited files in content/ and of the generated media registry.
import { z } from 'zod'
import {
  courseIdSchema,
  courseSchema,
  entitySchema,
  idSchema,
  mediaAssetSchema,
} from '../../src/schemas/content'
import { MUSEUM_REF } from './museums'

/** A Commons file title, e.g. "File:Johann Sebastian Bach.png". */
export const commonsFileSchema = z
  .string()
  .regex(/^File:.+\.[A-Za-z0-9]+$/, 'titre de fichier Commons attendu (« File:… »)')

const oneOrMany = z.union([idSchema, z.array(idSchema)])

/** content/entities/*.yaml — name and summary may be missing until ingest / hand editing. */
export const entitySourceSchema = entitySchema
  .omit({ mediaIds: true })
  .extend({
    name: z.string().min(1).optional(),
    summary: z.string().min(1).max(600).optional(),
    relations: z
      .object({
        createdBy: oneOrMany.optional(),
        belongsTo: oneOrMany.optional(),
        inPeriod: oneOrMany.optional(),
        influencedBy: oneOrMany.optional(),
        features: oneOrMany.optional(),
      })
      .strict()
      .optional(),
    /** Commons image (Wikidata P18), downloaded by fetch-media. */
    image: commonsFileSchema.optional(),
    /**
     * Open access image from a museum API instead of Commons: "aic:<id>" (Art Institute of
     * Chicago) or "met:<id>" (The Metropolitan Museum of Art).
     */
    museumImage: z
      .string()
      .regex(MUSEUM_REF, 'référence attendue « aic:<numéro> » ou « met:<numéro> »')
      .optional(),
    /** Replaces the author of the image when it is unusable (e.g. « Unknown author »). */
    imageCredit: z.string().min(1).optional(),
    /** Commons recording (Wikidata P51); a manifest excerpt takes precedence. */
    audio: commonsFileSchema.optional(),
  })
  .strict()
  .refine((entity) => !(entity.image && entity.museumImage), {
    message: 'image et museumImage : choisir l’un des deux',
  })

export const entityFileSchema = z
  .object({
    course: courseIdSchema,
    entities: z.array(entitySourceSchema),
  })
  .strict()

/** content/courses/*.yaml */
export const courseSourceSchema = courseSchema.strict()

const timecodeSchema = z.union([
  z.number().nonnegative(),
  z.string().regex(/^\d+:\d{2}(\.\d+)?$/, 'temps attendu en secondes ou « m:ss »'),
])

/** content/manifests/*-audio.yaml — hand-picked excerpts. */
export const audioManifestSchema = z
  .object({
    course: courseIdSchema,
    excerpts: z.array(
      z
        .object({
          entity: idSchema,
          id: idSchema.optional(),
          /** Commons file page URL / "File:…" title, or a direct URL to a free recording. */
          source: z.string().min(1),
          start: timecodeSchema.default(0),
          duration: z.number().min(15).max(25).default(20),
          /** Required for non-Commons sources; overrides Commons metadata otherwise. */
          credit: z.string().min(1).optional(),
          license: z.string().min(1).optional(),
          sourceUrl: z.url().optional(),
          note: z.string().optional(),
        })
        .strict(),
    ),
  })
  .strict()

/** content/generated/media.json — written by fetch-media, read by build-content. */
export const mediaRegistrySchema = z.object({
  assets: z.array(
    mediaAssetSchema.extend({
      course: courseIdSchema,
      entityId: idSchema,
      /** What the asset was produced from; a change triggers a re-fetch. */
      origin: z.object({
        source: z.string(),
        start: z.number().optional(),
        duration: z.number().optional(),
      }),
    }),
  ),
})

export type EntitySource = z.infer<typeof entitySourceSchema>
export type EntityFile = z.infer<typeof entityFileSchema>
export type AudioManifest = z.infer<typeof audioManifestSchema>
export type AudioExcerpt = AudioManifest['excerpts'][number]
export type MediaRegistry = z.infer<typeof mediaRegistrySchema>
export type RegistryAsset = MediaRegistry['assets'][number]

/** "1:23.5" → 83.5 */
export function parseTimecode(value: number | string): number {
  if (typeof value === 'number') return value
  const [minutes = '0', seconds = '0'] = value.split(':')
  return Number(minutes) * 60 + Number(seconds)
}
