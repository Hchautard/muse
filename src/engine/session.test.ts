import { describe, expect, it } from 'vitest'
import { dueCards, type CardRecord } from './cards'
import { isSensory, type Exercise } from './exercises'
import { Rating } from './fsrs'
import { buildSession, LESSON_LENGTH, LESSON_REVIEWS, REVIEW_LENGTH } from './session'
import {
  learnedMusicCards,
  makeArtCourse,
  makeCard,
  makeMusicCourse,
  MUSIC_LESSON_IDS,
} from './test-fixtures'

const music = makeMusicCourse()
const DAY = 24 * 60 * 60 * 1000
const learnedAt = new Date(2026, 9, 1, 10)
const later = (days: number) => new Date(learnedAt.getTime() + days * DAY)

function lesson(index: number, cards: CardRecord[] = [], now = later(30), seed = 1) {
  return buildSession({
    courseId: 'music',
    mode: { type: 'lesson', lessonId: MUSIC_LESSON_IDS[index]! },
    now,
    cards,
    content: music,
    seed,
  })
}

function review(cards: CardRecord[], now = later(30), seed = 1) {
  return buildSession({
    courseId: 'music',
    mode: { type: 'review' },
    now,
    cards,
    content: music,
    seed,
  })
}

function expectNoConsecutiveRepeat(session: Exercise[]) {
  session
    .slice(1)
    .forEach((exercise, i) => expect(exercise.entityId).not.toBe(session[i]!.entityId))
}

function expectMostlySensory(session: Exercise[]) {
  expect(session.filter(isSensory).length * 2).toBeGreaterThanOrEqual(session.length)
}

describe('buildSession — lesson mode', () => {
  it('fills a first lesson to the target length with its cards and some rework', () => {
    const session = lesson(0)
    expect(session).toHaveLength(LESSON_LENGTH)
    const graded = session.filter((e) => e.graded)
    expect(graded).toHaveLength(9) // 3 works × 3 skills
    expect(new Set(graded.map((e) => e.cardId)).size).toBe(9)
    expect(session.filter((e) => !e.graded)).toHaveLength(LESSON_LENGTH - 9)
    expect(new Set(session.map((e) => e.id)).size).toBe(session.length)
  })

  it('presents each new work before asking anything else about it', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const session = lesson(0, [], later(30), seed)
      expect(session[0]!.intro).toBe(true)
      const intros = session.filter((e) => e.intro)
      expect(intros.map((e) => e.entityId)).toEqual(['bach-1', 'bach-2', 'bach-3'])
      for (const intro of intros) {
        const first = session.findIndex((e) => e.entityId === intro.entityId)
        expect(session[first]).toBe(intro)
        expect(intro).toMatchObject({ graded: true, kind: 'audio-choice' })
      }
    }
  })

  it('never asks about the same work twice in a row', () => {
    for (let seed = 1; seed <= 30; seed++) {
      expectNoConsecutiveRepeat(lesson(0, [], later(30), seed))
      expectNoConsecutiveRepeat(lesson(2, learnedMusicCards(2, learnedAt), later(30), seed))
    }
  })

  it('interleaves 2 to 4 due reviews', () => {
    const cards = learnedMusicCards(2, learnedAt)
    const due = new Set(dueCards(cards, later(30)).map((c) => c.id))
    for (let seed = 1; seed <= 10; seed++) {
      const session = lesson(2, cards, later(30), seed)
      const reviews = session.filter((e) => !e.entityId.startsWith('mozart'))
      expect(reviews.length).toBeGreaterThanOrEqual(LESSON_REVIEWS.min)
      expect(reviews.length).toBeLessThanOrEqual(LESSON_REVIEWS.max)
      for (const r of reviews) expect(due.has(r.cardId)).toBe(true)
      // Reviews are spread out, not bunched at one end.
      const positions = session.flatMap((e, i) => (reviews.includes(e) ? [i] : []))
      expect(positions.at(-1)! - positions[0]!).toBeGreaterThanOrEqual(3)
    }
  })

  it('adds no review when nothing is due', () => {
    const cards = learnedMusicCards(2, learnedAt)
    const session = lesson(2, cards, learnedAt)
    expect(session.every((e) => e.entityId.startsWith('mozart'))).toBe(true)
  })

  it('keeps at least half of the exercises sensory and alternates media', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const session = lesson(4, learnedMusicCards(4, learnedAt), later(30), seed)
      expectMostlySensory(session)
      const textRuns = session.filter(
        (e, i) => i > 0 && !isSensory(e) && !isSensory(session[i - 1]!),
      )
      expect(textRuns.length).toBeLessThanOrEqual(1)
    }
  })

  it('skips the presentation when the lesson is replayed', () => {
    const cards = learnedMusicCards(1, learnedAt)
    const session = lesson(0, cards)
    expect(session.some((e) => e.intro)).toBe(false)
    expect(session.filter((e) => e.graded)).toHaveLength(9)
  })

  it('is deterministic for a given seed', () => {
    const cards = learnedMusicCards(3, learnedAt)
    expect(lesson(3, cards, later(30), 42)).toEqual(lesson(3, cards, later(30), 42))
    expect(lesson(3, cards, later(30), 42)).not.toEqual(lesson(3, cards, later(30), 43))
  })

  it('rejects an unknown lesson', () => {
    expect(() =>
      buildSession({
        courseId: 'music',
        mode: { type: 'lesson', lessonId: 'nope' },
        now: learnedAt,
        cards: [],
        content: music,
      }),
    ).toThrow(/Unknown lesson/)
  })
})

describe('buildSession — review mode', () => {
  it('takes up to 15 due cards, the most overdue first', () => {
    const cards = [...learnedMusicCards(2, learnedAt), ...learnedMusicCards(4, later(2)).slice(18)]
    const now = later(40)
    const session = review(cards, now)
    expect(session).toHaveLength(REVIEW_LENGTH)
    expect(session.every((e) => e.graded && !e.intro)).toBe(true)
    const expected = dueCards(cards, now)
      .slice(0, REVIEW_LENGTH)
      .map((c) => c.id)
    expect(new Set(session.map((e) => e.cardId))).toEqual(new Set(expected))
  })

  it('mixes skills and works', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const session = review(learnedMusicCards(5, learnedAt), later(40), seed)
      expectNoConsecutiveRepeat(session)
      expectMostlySensory(session)
      expect(new Set(session.map((e) => e.skill)).size).toBe(3)
      const sameSkillPairs = session.filter((e, i) => i > 0 && e.skill === session[i - 1]!.skill)
      expect(sameSkillPairs.length).toBeLessThan(session.length / 2)
    }
  })

  it('offers the most fragile cards when nothing is due', () => {
    const cards = learnedMusicCards(2, learnedAt)
    const fragile = [
      makeCard('bach-2', 'audio-to-composer', learnedAt, Rating.Again),
      makeCard('vivaldi-3', 'audio-to-period', learnedAt, Rating.Again),
    ]
    const all = [...cards.filter((c) => !fragile.some((f) => f.id === c.id)), ...fragile]
    expect(dueCards(all, learnedAt)).toHaveLength(0)
    const session = review(all, learnedAt)
    expect(session.length).toBeGreaterThan(0)
    expect(session.map((e) => e.cardId)).toEqual(expect.arrayContaining(fragile.map((f) => f.id)))
  })

  it('is empty without any card of the course', () => {
    expect(review([])).toEqual([])
    const other = learnedMusicCards(1, learnedAt).map((c) => ({ ...c, courseId: 'art' as const }))
    expect(review(other)).toEqual([])
  })
})

describe('buildSession — image skills', () => {
  it('asks paintings with images and chronologies', () => {
    const art = makeArtCourse()
    const session = buildSession({
      courseId: 'art',
      mode: { type: 'lesson', lessonId: 'art-lesson' },
      now: learnedAt,
      cards: [],
      content: art,
      seed: 7,
    })
    expect(session.filter((e) => e.intro)).toHaveLength(6)
    expect(new Set(session.map((e) => e.kind))).toEqual(new Set(['image-choice', 'chronology']))
    expect(new Set(session.map((e) => e.skill))).toEqual(
      new Set(['image-to-artist', 'image-to-movement', 'work-to-date']),
    )
    expectNoConsecutiveRepeat(session)
    expectMostlySensory(session)
  })
})
