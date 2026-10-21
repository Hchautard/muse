// Adapter around ts-fsrs: turns an answer into a rating and schedules the next review.
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade,
  type ReviewLog,
} from 'ts-fsrs'
import type { ExerciseKind } from './exercises'

export { Rating, State, type Card, type Grade }

// Day-based scheduling: short-term learning happens inside the session (rework and retries), so
// FSRS's minute-level learning steps are disabled. Fuzz spreads cards learned together.
const scheduler = fsrs(generatorParameters({ enable_short_term: false, enable_fuzz: true }))

/** A correct answer faster than this is rated Easy; 0 means never. */
export type EasyThresholds = Record<ExerciseKind, number>

export const DEFAULT_EASY_THRESHOLDS_MS: EasyThresholds = {
  // Includes the tap on the play button.
  'audio-choice': 6000,
  'image-choice': 4000,
  'true-false': 4000,
  chronology: 0,
}

export interface GradedAnswer {
  kind: ExerciseKind
  correct: boolean
  durationMs: number
}

/** Wrong → Again, right → Good, right and very fast → Easy. */
export function gradeAnswer(
  answer: GradedAnswer,
  thresholds: EasyThresholds = DEFAULT_EASY_THRESHOLDS_MS,
): Grade {
  if (!answer.correct) return Rating.Again
  const easyBelow = thresholds[answer.kind]
  return easyBelow > 0 && answer.durationMs < easyBelow ? Rating.Easy : Rating.Good
}

export function newFsrsCard(now: Date): Card {
  return createEmptyCard(now)
}

export function scheduleReview(
  card: Card,
  grade: Grade,
  now: Date,
): { card: Card; log: ReviewLog } {
  return scheduler.next(card, now, grade)
}

/** Stability (in days) from which a card counts as fully mastered. */
export const MASTERED_STABILITY_DAYS = 21

/** 0 for a new card, up to 1 once its memory is stable for three weeks. */
export function mastery(card: Card | undefined): number {
  if (!card || card.state === State.New) return 0
  return Math.min(1, card.stability / MASTERED_STABILITY_DAYS)
}
