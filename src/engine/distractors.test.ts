import { describe, expect, it } from 'vitest'
import { closeness, pickDistractors } from './distractors'
import { createRng } from './random'
import { makeMusicCourse } from './test-fixtures'

const music = makeMusicCourse()
const bach = music.entity('bach')!
const baroque = music.entity('baroque')!
const toccata = music.entity('bach-1')!

const pick = (answer = bach, mastery = 0, seed = 1, options = {}) =>
  pickDistractors(
    answer,
    answer === toccata ? 'work-to-date' : 'audio-to-composer',
    music,
    mastery,
    {
      rng: createRng(seed),
      ...options,
    },
  )

const meanCloseness = (mastery: number) => {
  let total = 0
  for (let seed = 1; seed <= 50; seed++)
    for (const d of pick(bach, mastery, seed)) total += closeness(bach, d, music)
  return total / (50 * 3)
}

describe('pickDistractors', () => {
  it('returns three entities of the answer’s type, without duplicates or the answer', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const mastery of [0, 0.5, 1]) {
        const distractors = pick(bach, mastery, seed)
        expect(distractors).toHaveLength(3)
        expect(distractors.every((d) => d.type === 'person')).toBe(true)
        expect(distractors.map((d) => d.id)).not.toContain('bach')
        expect(new Set(distractors.map((d) => d.id)).size).toBe(3)
      }
    }
  })

  it('picks periods against a period, and as many as exist', () => {
    const distractors = pickDistractors(baroque, 'audio-to-period', music, 0, { rng: createRng(1) })
    expect(distractors.map((d) => d.id).sort()).toEqual(['classique', 'romantique', 'xxe'])
  })

  it('gets closer as the card is mastered', () => {
    const easy = meanCloseness(0)
    const medium = meanCloseness(0.5)
    const hard = meanCloseness(1)
    expect(easy).toBeLessThan(medium)
    expect(medium).toBeLessThan(hard)
  })

  it('draws a new card’s distractors from other eras, a mastered card’s from the same one', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(pick(bach, 0, seed).map((d) => d.id)).not.toContain('vivaldi')
      expect(pick(bach, 1, seed).map((d) => d.id)).toContain('vivaldi')
    }
  })

  it('favours entities the learner has met', () => {
    const rate = (encountered?: Set<string>) => {
      let hits = 0
      for (let seed = 1; seed <= 100; seed++)
        if (pick(bach, 0.2, seed, { encountered }).some((d) => d.id === 'mozart')) hits++
      return hits
    }
    expect(rate(new Set(['mozart']))).toBeGreaterThan(rate())
  })

  it('is deterministic for a given seed', () => {
    expect(pick(bach, 0.3, 9)).toEqual(pick(bach, 0.3, 9))
  })

  it('gives every work of a chronology a different year', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const mastery of [0, 1]) {
        const works = pick(toccata, mastery, seed)
        expect(works.every((w) => w.type === 'work')).toBe(true)
        const years = [toccata, ...works].map((w) => w.year)
        expect(new Set(years).size).toBe(years.length)
      }
    }
  })
})

describe('closeness', () => {
  it('ranks contemporaries above distant composers', () => {
    const vivaldi = music.entity('vivaldi')!
    const mozart = music.entity('mozart')!
    const ravel = music.entity('ravel')!
    expect(closeness(bach, vivaldi, music)).toBeGreaterThan(closeness(bach, mozart, music))
    expect(closeness(bach, mozart, music)).toBeGreaterThan(closeness(bach, ravel, music))
    expect(closeness(bach, ravel, music)).toBe(0)
  })
})
