// Progress through a session: answers, retries of missed cards, and the final tally.
import { shuffleOutOfOrder, type Exercise, type ExerciseResult } from './exercises'
import { createRng, hashSeed, shuffle } from './random'
import { sessionXp, type XpBreakdown } from './xp'

export interface Answer {
  exercise: Exercise
  result: ExerciseResult
  answeredAt: Date
}

export interface SessionRun {
  /** Grows when a missed card is queued again. */
  queue: Exercise[]
  /** Index of the current exercise in `queue`. */
  position: number
  /** One per exercise up to the current one, once it is answered. */
  answers: Answer[]
}

export const startRun = (exercises: Exercise[]): SessionRun => ({
  queue: exercises,
  position: 0,
  answers: [],
})

export const currentExercise = (run: SessionRun): Exercise | undefined => run.queue[run.position]
export const isAnswered = (run: SessionRun) => run.answers.length > run.position
export const isFinished = (run: SessionRun) => run.position >= run.queue.length
/** Share of the (current) queue answered so far, from 0 to 1. */
export const runProgress = (run: SessionRun) =>
  run.queue.length === 0 ? 1 : run.answers.length / run.queue.length

/** Records the answer to the current exercise; a miss queues one ungraded retry at the end. */
export function recordAnswer(
  run: SessionRun,
  result: ExerciseResult,
  answeredAt: Date,
): SessionRun {
  const exercise = currentExercise(run)
  if (!exercise || isAnswered(run)) return run
  const answers = [...run.answers, { exercise, result, answeredAt }]
  const queue =
    result.correct || exercise.retry
      ? run.queue
      : insertRetry(run.queue, run.position, retryOf(exercise))
  return { ...run, queue, answers }
}

/** Moves on once the current exercise is answered. */
export function advance(run: SessionRun): SessionRun {
  return isAnswered(run) ? { ...run, position: run.position + 1 } : run
}

/** Same question, reshuffled, not rated again. */
function retryOf(exercise: Exercise): Exercise {
  const rng = createRng(hashSeed(exercise.id))
  const retry = {
    ...exercise,
    id: `${exercise.id}-retry`,
    graded: false,
    intro: false,
    retry: true,
  }
  if (retry.kind === 'chronology')
    return { ...retry, itemIds: shuffleOutOfOrder(retry.answerIds, rng) }
  if (retry.kind === 'true-false') return retry
  return { ...retry, optionIds: shuffle(retry.optionIds, rng) }
}

/** Appends the retry, or slots it in just before the end to avoid repeating a work. */
function insertRetry(queue: Exercise[], position: number, retry: Exercise): Exercise[] {
  for (let at = queue.length; at > position; at--) {
    if (queue[at - 1]?.entityId !== retry.entityId && queue[at]?.entityId !== retry.entityId)
      return [...queue.slice(0, at), retry, ...queue.slice(at)]
  }
  return [...queue, retry]
}

export interface SessionSummary {
  /** First attempts only: retries do not count. */
  answered: number
  correct: number
  /** From 0 to 1. */
  accuracy: number
  xp: XpBreakdown
}

export function summarizeRun(run: SessionRun, { lessonCompleted }: { lessonCompleted: boolean }) {
  const firstAttempts = run.answers.filter((a) => !a.exercise.retry)
  const correct = firstAttempts.filter((a) => a.result.correct).length
  const summary: SessionSummary = {
    answered: firstAttempts.length,
    correct,
    accuracy: firstAttempts.length === 0 ? 0 : correct / firstAttempts.length,
    xp: sessionXp({
      correctAnswers: correct,
      mistakes: firstAttempts.length - correct,
      lessonCompleted,
    }),
  }
  return summary
}
