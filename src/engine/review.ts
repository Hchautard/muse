// Turns a session's answers into updated cards and review log entries.
import type { CourseId } from '../schemas/content'
import type { CardRecord } from './cards'
import { expectedAnswerId, type ExerciseKind, type Mismatch } from './exercises'
import {
  DEFAULT_EASY_THRESHOLDS_MS,
  gradeAnswer,
  newFsrsCard,
  scheduleReview,
  type EasyThresholds,
  type Grade,
} from './fsrs'
import type { Answer } from './run'

export interface ReviewEntry {
  cardId: string
  rating: Grade
  answeredAt: Date
  durationMs: number
  correct: boolean
  kind: ExerciseKind
  /** For confusion statistics: what was expected and what the learner chose. */
  expectedId?: string
  chosenId?: string
  /** Association: the wrong pairings tried. */
  mismatches?: Mismatch[]
}

export interface ReviewOutcome {
  /** New and updated cards. */
  cards: CardRecord[]
  reviews: ReviewEntry[]
}

/**
 * Rates every graded answer with FSRS, at most once per card. Ungraded answers (rework,
 * retries of missed cards) leave the schedule untouched.
 */
export function applyAnswers(
  courseId: CourseId,
  existing: ReadonlyMap<string, CardRecord>,
  answers: readonly Answer[],
  thresholds: EasyThresholds = DEFAULT_EASY_THRESHOLDS_MS,
): ReviewOutcome {
  const updated = new Map<string, CardRecord>()
  const reviews: ReviewEntry[] = []

  for (const { exercise, result, answeredAt } of answers) {
    if (!exercise.graded || updated.has(exercise.cardId)) continue
    const card: CardRecord = existing.get(exercise.cardId) ?? {
      id: exercise.cardId,
      courseId,
      entityId: exercise.entityId,
      skill: exercise.skill,
      fsrs: newFsrsCard(answeredAt),
      introducedAt: answeredAt,
    }
    const rating = gradeAnswer({ kind: exercise.kind, ...result }, thresholds)
    updated.set(card.id, { ...card, fsrs: scheduleReview(card.fsrs, rating, answeredAt).card })
    reviews.push({
      cardId: card.id,
      rating,
      answeredAt,
      durationMs: result.durationMs,
      correct: result.correct,
      kind: exercise.kind,
      expectedId: expectedAnswerId(exercise),
      chosenId: result.chosenId,
      ...(result.mismatches?.length ? { mismatches: result.mismatches } : {}),
    })
  }
  return { cards: [...updated.values()], reviews }
}
