// The progress backup file: what "Exporter" writes and "Importer" reads. Pure functions (no
// IndexedDB), so that a round trip can be tested exactly.
import { z } from 'zod'
import type { CardRecord } from '../engine/cards'
import type { ChallengeRecord } from '../engine/challenge'
import { EXERCISE_KINDS } from '../engine/exercises'
import { Rating, State, type Grade } from '../engine/fsrs'
import type { DayStats } from '../engine/streak'
import { courseIdSchema, idSchema, skillSchema } from '../schemas/content'
import type { LessonRecord, ReviewLogRecord, SettingRecord } from './db'

export const BACKUP_FORMAT = 'muse-progress'
/** Version 2 adds the daily challenges; version 1 files are still read. */
export const BACKUP_VERSION = 2

/** Every table of the database. */
export interface ProgressData {
  cards: CardRecord[]
  reviewLog: ReviewLogRecord[]
  lessons: LessonRecord[]
  daily: DayStats[]
  settings: SettingRecord[]
  challenges: ChallengeRecord[]
}

export interface Backup extends ProgressData {
  exportedAt: Date
}

export class BackupError extends Error {}

// Dates travel as ISO strings. Records are loose so that no field is ever dropped on the way.
const date = z.iso.datetime().transform((value) => new Date(value))
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const count = z.number().int().nonnegative()
const grade = z.union([
  z.literal(Rating.Again),
  z.literal(Rating.Hard),
  z.literal(Rating.Good),
  z.literal(Rating.Easy),
]) satisfies z.ZodType<Grade>

const fsrsCardSchema = z.looseObject({
  due: date,
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  learning_steps: z.number(),
  reps: count,
  lapses: count,
  state: z.enum(State),
  last_review: date.optional(),
})

const mismatchSchema = z.object({ expectedId: idSchema, chosenId: idSchema })

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.union([z.literal(1), z.literal(BACKUP_VERSION)]),
  exportedAt: date,
  cards: z.array(
    z.looseObject({
      id: z.string().min(1),
      courseId: courseIdSchema,
      entityId: idSchema,
      skill: skillSchema,
      fsrs: fsrsCardSchema,
      introducedAt: date,
    }),
  ),
  reviewLog: z.array(
    z.looseObject({
      id: z.number().int().positive().optional(),
      courseId: courseIdSchema,
      cardId: z.string().min(1),
      rating: grade,
      answeredAt: date,
      durationMs: z.number().nonnegative(),
      correct: z.boolean(),
      kind: z.enum(EXERCISE_KINDS),
      expectedId: idSchema.optional(),
      chosenId: idSchema.optional(),
      mismatches: z.array(mismatchSchema).optional(),
    }),
  ),
  lessons: z.array(
    z.looseObject({
      lessonId: idSchema,
      courseId: courseIdSchema,
      completedAt: date,
      bestScore: z.number().min(0).max(1),
    }),
  ),
  daily: z.array(
    z.looseObject({
      date: day,
      xp: count,
      minutes: z.number().nonnegative(),
      sessions: count,
      goal: count,
    }),
  ),
  settings: z.array(z.looseObject({ key: z.string().min(1), value: z.unknown() })),
  challenges: z
    .array(
      z.looseObject({
        date: day,
        courseId: courseIdSchema,
        workId: idSchema,
        optionIds: z.array(idSchema),
        focus: z.object({ x: z.number(), y: z.number() }),
        guesses: z.array(idSchema),
      }),
    )
    .default([]),
})

export function serializeBackup(data: ProgressData, exportedAt: Date): string {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    ...data,
  })
}

/** Reads a backup file; throws a BackupError with a message for the learner. */
export function parseBackup(text: string): Backup {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new BackupError('Ce fichier n’est pas une sauvegarde Muse (JSON illisible).')
  }
  const header = z.object({ format: z.string(), version: z.number() }).safeParse(json)
  if (!header.success || header.data.format !== BACKUP_FORMAT)
    throw new BackupError('Ce fichier n’est pas une sauvegarde Muse.')
  if (header.data.version > BACKUP_VERSION)
    throw new BackupError('Cette sauvegarde vient d’une version plus récente de Muse.')

  const result = backupSchema.safeParse(json)
  if (!result.success) {
    console.error(z.prettifyError(result.error))
    throw new BackupError('Cette sauvegarde est incomplète ou abîmée.')
  }
  const { format, version, ...backup } = result.data
  return backup as Backup
}

/** Default file name, e.g. "muse-progression-2026-10-21.json". */
export const backupFileName = (today: string) => `muse-progression-${today}.json`
