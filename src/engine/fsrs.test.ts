import { describe, expect, it } from 'vitest'
import { startOfNextDay } from './calendar'
import {
  DEFAULT_EASY_THRESHOLDS_MS,
  gradeAnswer,
  mastery,
  newFsrsCard,
  Rating,
  scheduleReview,
  State,
  type Grade,
} from './fsrs'

const now = new Date(2026, 9, 21, 20, 30)
const DAY = 24 * 60 * 60 * 1000

describe('gradeAnswer', () => {
  it('maps a wrong answer to Again', () => {
    expect(gradeAnswer({ kind: 'audio-choice', correct: false, durationMs: 1000 })).toBe(
      Rating.Again,
    )
  })

  it('maps a right answer to Good, or Easy when very fast', () => {
    expect(gradeAnswer({ kind: 'image-choice', correct: true, durationMs: 9000 })).toBe(Rating.Good)
    expect(gradeAnswer({ kind: 'image-choice', correct: true, durationMs: 2500 })).toBe(Rating.Easy)
    expect(gradeAnswer({ kind: 'image-choice', correct: true, durationMs: 4000 })).toBe(Rating.Good)
  })

  it('uses configurable thresholds per exercise kind', () => {
    const answer = { kind: 'true-false' as const, correct: true, durationMs: 4500 }
    expect(gradeAnswer(answer)).toBe(Rating.Good)
    expect(gradeAnswer(answer, { ...DEFAULT_EASY_THRESHOLDS_MS, 'true-false': 5000 })).toBe(
      Rating.Easy,
    )
  })

  it('never rates a chronology Easy', () => {
    expect(gradeAnswer({ kind: 'chronology', correct: true, durationMs: 100 })).toBe(Rating.Good)
  })
})

describe('scheduleReview', () => {
  const after = (grade: Grade) => scheduleReview(newFsrsCard(now), grade, now)

  it('schedules in days, never later the same day', () => {
    for (const grade of [Rating.Again, Rating.Good, Rating.Easy] as const) {
      const { card, log } = after(grade)
      expect(card.state).toBe(State.Review)
      expect(card.due.getTime()).toBeGreaterThanOrEqual(startOfNextDay(now).getTime())
      expect(log.rating).toBe(grade)
    }
  })

  it('waits longer after Good than after Again, and after Easy than after Good', () => {
    const again = after(Rating.Again).card.due.getTime()
    const good = after(Rating.Good).card.due.getTime()
    const easy = after(Rating.Easy).card.due.getTime()
    expect(again).toBeLessThan(good)
    expect(good).toBeLessThan(easy)
  })

  it('stretches the interval after each successful review and shrinks it after a lapse', () => {
    let card = after(Rating.Good).card
    const first = card.scheduled_days
    card = scheduleReview(card, Rating.Good, card.due).card
    expect(card.scheduled_days).toBeGreaterThan(first)
    const lapsed = scheduleReview(card, Rating.Again, card.due).card
    expect(lapsed.lapses).toBe(1)
    expect(lapsed.due.getTime() - card.due.getTime()).toBeLessThan(first * DAY + DAY)
  })
})

describe('mastery', () => {
  it('is 0 for a new or unknown card and grows towards 1', () => {
    expect(mastery(undefined)).toBe(0)
    expect(mastery(newFsrsCard(now))).toBe(0)
    let card = scheduleReview(newFsrsCard(now), Rating.Good, now).card
    const first = mastery(card)
    expect(first).toBeGreaterThan(0)
    for (let i = 0; i < 6; i++) card = scheduleReview(card, Rating.Good, card.due).card
    expect(mastery(card)).toBeGreaterThan(first)
    expect(mastery(card)).toBeLessThanOrEqual(1)
  })
})
