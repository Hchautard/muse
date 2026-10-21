import { describe, expect, it } from 'vitest'
import type { Exercise } from './exercises'
import { applyAnswers } from './review'
import {
  advance,
  currentExercise,
  isAnswered,
  isFinished,
  recordAnswer,
  runProgress,
  startRun,
  summarizeRun,
  type SessionRun,
} from './run'
import { buildSession } from './session'
import { makeMusicCourse, MUSIC_LESSON_IDS } from './test-fixtures'

const music = makeMusicCourse()
const now = new Date(2026, 9, 21, 9)

const session = buildSession({
  courseId: 'music',
  mode: { type: 'lesson', lessonId: MUSIC_LESSON_IDS[0]! },
  now,
  cards: [],
  content: music,
  seed: 3,
})

/** Answers every exercise; `wrong` lists the positions (first pass) answered wrongly. */
function play(wrong: number[] = [], wrongRetries = false): SessionRun {
  let run = startRun(session)
  let index = 0
  while (!isFinished(run)) {
    const exercise = currentExercise(run)!
    const correct = exercise.retry ? !wrongRetries : !wrong.includes(index)
    run = advance(
      recordAnswer(run, { correct, durationMs: 5000 }, new Date(now.getTime() + index * 10_000)),
    )
    index++
  }
  return run
}

describe('session run', () => {
  it('goes through every exercise once when all answers are right', () => {
    const run = play()
    expect(run.answers).toHaveLength(session.length)
    expect(runProgress(run)).toBe(1)
  })

  it('asks a missed card again at the end, without grading it again', () => {
    const run = play([1, 4])
    expect(run.queue).toHaveLength(session.length + 2)
    const retries = run.queue.filter((e) => e.retry)
    expect(retries.map((e) => e.cardId).sort()).toEqual(
      [session[1]!.cardId, session[4]!.cardId].sort(),
    )
    expect(retries.every((e) => !e.graded && !e.intro)).toBe(true)
    // At the end: after every first-pass exercise, or just before the last one to keep works apart.
    for (const retry of retries)
      expect(run.queue.indexOf(retry)).toBeGreaterThanOrEqual(session.length - 1)
  })

  it('does not queue a retry of a retry', () => {
    const run = play([0], true)
    expect(run.queue.filter((e) => e.retry)).toHaveLength(1)
  })

  it('keeps works apart when queuing retries', () => {
    const run = play([session.length - 1, session.length - 2])
    run.queue.slice(1).forEach((e, i) => expect(e.entityId).not.toBe(run.queue[i]!.entityId))
  })

  it('waits for an answer before moving on, and records one answer per exercise', () => {
    let run = startRun(session)
    expect(advance(run)).toBe(run)
    run = recordAnswer(run, { correct: true, durationMs: 1000 }, now)
    expect(isAnswered(run)).toBe(true)
    expect(recordAnswer(run, { correct: false, durationMs: 1000 }, now)).toBe(run)
    expect(advance(run).position).toBe(1)
  })

  it('tallies first attempts and XP', () => {
    const summary = summarizeRun(play([1, 4]), { lessonCompleted: true })
    expect(summary.answered).toBe(session.length)
    expect(summary.correct).toBe(session.length - 2)
    expect(summary.accuracy).toBeCloseTo((session.length - 2) / session.length)
    expect(summary.xp.total).toBe((session.length - 2) * 10 + 5)
    expect(summarizeRun(play(), { lessonCompleted: true }).xp.total).toBe(session.length * 10 + 10)
  })
})

describe('applyAnswers', () => {
  it('rates each graded card once and leaves practice alone', () => {
    const run = play([1])
    const { cards, reviews } = applyAnswers('music', new Map(), run.answers)
    const gradedCards = new Set(session.filter((e) => e.graded).map((e) => e.cardId))
    expect(cards.map((c) => c.id).sort()).toEqual([...gradedCards].sort())
    expect(reviews).toHaveLength(gradedCards.size)
    for (const card of cards) {
      expect(card.courseId).toBe('music')
      expect(card.fsrs.reps).toBe(1)
      expect(card.introducedAt.getTime()).toBeGreaterThanOrEqual(now.getTime())
    }
  })

  it('logs the expected and chosen answers', () => {
    const exercise = session.find((e) => e.kind === 'audio-choice' && e.graded) as Exercise & {
      kind: 'audio-choice'
    }
    const wrongId = exercise.optionIds.find((id) => id !== exercise.answerId)!
    const run = recordAnswer(
      startRun([exercise]),
      { correct: false, durationMs: 3000, chosenId: wrongId },
      now,
    )
    const { reviews } = applyAnswers('music', new Map(), run.answers)
    expect(reviews[0]).toMatchObject({
      cardId: exercise.cardId,
      rating: 1,
      correct: false,
      kind: 'audio-choice',
      expectedId: exercise.answerId,
      chosenId: wrongId,
    })
  })

  it('updates existing cards instead of creating new ones', () => {
    const first = applyAnswers('music', new Map(), play().answers).cards
    const existing = new Map(first.map((c) => [c.id, c]))
    const later = new Date(now.getTime() + 5 * 24 * 3600 * 1000)
    const answers = play().answers.map((a) => ({ ...a, answeredAt: later }))
    const second = applyAnswers('music', existing, answers).cards
    for (const card of second) {
      expect(card.fsrs.reps).toBe(2)
      expect(card.introducedAt).toEqual(existing.get(card.id)!.introducedAt)
    }
  })
})
