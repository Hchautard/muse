import { describe, expect, it } from 'vitest'
import {
  CHALLENGE_GUESSES,
  CHALLENGE_OPTIONS,
  challengeStatus,
  challengeStreak,
  challengeXp,
  guess,
  pickChallenge,
  revealedClues,
  shareText,
  type ChallengeRecord,
} from './challenge'
import { addSession, addXp } from './streak'
import { learnedMusicCards, makeArtCourse, makeCard, makeMusicCourse } from './test-fixtures'

const music = makeMusicCourse()
const art = makeArtCourse()
const learnedAt = new Date(2026, 9, 1, 9)
const cards = learnedMusicCards(3, learnedAt)

const pick = (date: string, past: ChallengeRecord[] = []) =>
  pickChallenge({ date, courses: [music, art], cards, past })

describe('picking the daily challenge', () => {
  it('waits for a first lesson', () => {
    expect(pickChallenge({ date: '2026-10-21', courses: [music], cards: [], past: [] })).toBe(
      undefined,
    )
  })

  it('hides a work already met among close titles of the same course', () => {
    const met = new Set(cards.map((c) => c.entityId))
    for (const date of ['2026-10-21', '2026-10-22', '2026-10-23', '2026-11-30']) {
      const challenge = pick(date)!
      expect(challenge.courseId).toBe('music')
      expect(met.has(challenge.workId)).toBe(true)
      expect(challenge.optionIds).toHaveLength(CHALLENGE_OPTIONS)
      expect(new Set(challenge.optionIds).size).toBe(CHALLENGE_OPTIONS)
      expect(challenge.optionIds).toContain(challenge.workId)
      const years = challenge.optionIds.map((id) => music.entity(id)?.year)
      expect(new Set(years).size).toBe(CHALLENGE_OPTIONS)
      for (const value of [challenge.focus.x, challenge.focus.y]) {
        expect(value).toBeGreaterThanOrEqual(0.25)
        expect(value).toBeLessThanOrEqual(0.75)
      }
    }
  })

  it('is the same all day long and changes from one day to the next', () => {
    expect(pick('2026-10-21')).toEqual(pick('2026-10-21'))
    const works = new Set(
      ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map(
        (date) => pick(date)!.workId,
      ),
    )
    expect(works.size).toBeGreaterThan(1)
  })

  it('does not bring back a recent mystery while others are left', () => {
    const past: ChallengeRecord[] = []
    for (let day = 1; day <= 9; day++) {
      const date = `2026-10-${String(day).padStart(2, '0')}`
      past.push({ ...pick(date, past)!, guesses: [] })
    }
    // Nine works met, nine days: each one once.
    expect(new Set(past.map((c) => c.workId)).size).toBe(9)
  })

  it('can pick a painting from the other course', () => {
    const artCards = ['monet-1', 'renoir-1', 'picasso-1'].map((id) => ({
      ...makeCard(id, 'image-to-artist', learnedAt),
      courseId: 'art' as const,
    }))
    const challenge = pickChallenge({
      date: '2026-10-21',
      courses: [music, art],
      cards: artCards,
      past: [],
    })
    expect(challenge?.courseId).toBe('art')
    expect(challenge?.optionIds.every((id) => art.entity(id)?.type === 'work')).toBe(true)
  })
})

describe('playing the daily challenge', () => {
  const start: ChallengeRecord = { ...pick('2026-10-21')!, guesses: [] }
  const wrong = start.optionIds.filter((id) => id !== start.workId)

  it('reveals one more clue after each wrong guess', () => {
    let record = start
    expect(revealedClues(record)).toBe(0)
    record = guess(record, wrong[0]!)
    expect(revealedClues(record)).toBe(1)
    expect(guess(record, wrong[0]!)).toBe(record)
    record = guess(record, start.workId)
    expect(challengeStatus(record)).toBe('found')
    expect(revealedClues(record)).toBe(CHALLENGE_GUESSES - 1)
    expect(challengeXp(record)).toBe(15)
    expect(guess(record, wrong[1]!)).toBe(record)
  })

  it('is missed after four wrong guesses, without XP', () => {
    const record = wrong.slice(0, 4).reduce(guess, start)
    expect(challengeStatus(record)).toBe('missed')
    expect(challengeXp(record)).toBe(0)
    expect(guess(record, start.workId)).toBe(record)
  })

  it('gives more XP for a quicker find', () => {
    expect(challengeXp(guess(start, start.workId))).toBe(20)
  })

  it('shares the result without giving the work away', () => {
    const record = guess(guess(start, wrong[0]!), start.workId)
    expect(shareText(record, '21 octobre')).toBe(
      'Muse · œuvre mystère du 21 octobre : trouvée en 2 essais\n🟥🟩⬜⬜',
    )
    expect(shareText(record, '21 octobre')).not.toContain(music.entity(start.workId)!.name)
  })
})

describe('challenge streak', () => {
  const day = (date: string, found: boolean): ChallengeRecord => ({
    date,
    courseId: 'music',
    workId: 'w',
    optionIds: ['w', 'x'],
    focus: { x: 0.5, y: 0.5 },
    guesses: found ? ['w'] : ['x', 'x2', 'x3', 'x4'],
  })

  it('counts consecutive days with the mystery found', () => {
    const records = [day('2026-10-18', true), day('2026-10-19', true), day('2026-10-20', true)]
    expect(challengeStreak(records, '2026-10-20')).toBe(3)
    // Today not played yet: the streak still stands.
    expect(challengeStreak(records, '2026-10-21')).toBe(3)
    expect(challengeStreak([...records, day('2026-10-21', false)], '2026-10-22')).toBe(0)
  })
})

describe('challenge XP', () => {
  it('adds to the day without counting a session', () => {
    const day = addXp(
      addSession(undefined, '2026-10-21', { xp: 40, minutes: 4 }, 2),
      '2026-10-21',
      15,
      3,
    )
    expect(day).toEqual({ date: '2026-10-21', xp: 55, minutes: 4, sessions: 1, goal: 2 })
    expect(addXp(undefined, '2026-10-21', 20, 1)).toEqual({
      date: '2026-10-21',
      xp: 20,
      minutes: 0,
      sessions: 0,
      goal: 1,
    })
  })
})
