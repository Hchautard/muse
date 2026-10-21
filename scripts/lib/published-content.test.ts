// The published courses, played through by the engine: every lesson must make a full session.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { localDay } from '../../src/engine/calendar'
import type { CardRecord } from '../../src/engine/cards'
import { isSensory, type Exercise } from '../../src/engine/exercises'
import { applyAnswers } from '../../src/engine/review'
import { advance, recordAnswer, startRun, type SessionRun } from '../../src/engine/run'
import { buildSession, LESSON_LENGTH } from '../../src/engine/session'
import { contentIndexSchema, courseBundleSchema } from '../../src/schemas/content'
import { createCourseIndex } from '../../src/content/course-index'
import { PATHS } from './content-files'

const dir = PATHS.publicContent
const index = contentIndexSchema.parse(JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')))
const DAY = 24 * 3600 * 1000

function answerAll(exercises: Exercise[], at: Date): SessionRun {
  let run = startRun(exercises)
  exercises.forEach((_, i) => {
    const answeredAt = new Date(at.getTime() + i * 1000)
    run = advance(recordAnswer(run, { correct: true, durationMs: 5000 }, answeredAt))
  })
  return run
}

function expectWellFormed(session: Exercise[]) {
  session.slice(1).forEach((e, i) => expect(e.entityId).not.toBe(session[i]!.entityId))
  expect(session.filter(isSensory).length * 2).toBeGreaterThanOrEqual(session.length)
  for (const exercise of session) {
    if (exercise.kind === 'audio-choice' || exercise.kind === 'image-choice') {
      expect(new Set(exercise.optionIds).size).toBe(4)
      expect(exercise.optionIds).toContain(exercise.answerId)
    }
    if (exercise.kind === 'chronology') expect(exercise.itemIds.length).toBeGreaterThanOrEqual(3)
  }
}

describe.each(index.courses)('published course « $title »', ({ id, file }) => {
  const content = createCourseIndex(
    courseBundleSchema.parse(JSON.parse(readFileSync(join(dir, file), 'utf8'))),
  )

  it('makes a full session of every lesson, then reviews with every kind of exercise', () => {
    let cards: CardRecord[] = []
    let now = new Date(2026, 9, 1, 9)
    for (const { lesson } of content.lessons) {
      const session = buildSession({
        courseId: id,
        mode: { type: 'lesson', lessonId: lesson.id },
        now,
        cards,
        content,
        seed: 7,
      })
      expect(session.length, lesson.id).toBe(LESSON_LENGTH)
      expect(session.filter((e) => e.intro).length, lesson.id).toBeGreaterThanOrEqual(3)
      expectWellFormed(session)

      const { cards: updated } = applyAnswers(
        id,
        new Map(cards.map((c) => [c.id, c])),
        answerAll(session, now).answers,
      )
      const ids = new Set(updated.map((c) => c.id))
      cards = [...cards.filter((c) => !ids.has(c.id)), ...updated]
      now = new Date(now.getTime() + DAY)
    }

    // Once everything is well known, reviews bring in the other kinds of exercise.
    const known = cards.map((c) => ({ ...c, fsrs: { ...c.fsrs, stability: 30, due: now } }))
    const kinds = new Set<string>()
    for (let day = 0; day < 6; day++) {
      const review = buildSession({
        courseId: id,
        mode: { type: 'review' },
        now: new Date(now.getTime() + day * DAY),
        cards: known,
        content,
        seed: day,
      })
      expectWellFormed(review)
      for (const exercise of review) kinds.add(exercise.kind)
    }
    const expected =
      id === 'art'
        ? ['image-choice', 'true-false', 'detail', 'association', 'chronology']
        : ['audio-choice', 'true-false', 'association', 'chronology']
    expect([...kinds].sort(), localDay(now)).toEqual(expected.sort())
  })
})
