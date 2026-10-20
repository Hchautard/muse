import { describe, expect, it } from 'vitest'
import { createRng, hashSeed, shuffle } from './random'

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = Array.from({ length: 20 }, a)
    const seqB = Array.from({ length: 20 }, b)
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const seqA = Array.from({ length: 5 }, createRng(1))
    const seqB = Array.from({ length: 5 }, createRng(2))
    expect(seqA).not.toEqual(seqB)
  })

  it('stays within [0, 1)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 10_000; i++) {
      const value = rng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('hashSeed', () => {
  it('is stable and distinguishes inputs', () => {
    expect(hashSeed('music:lesson-1')).toBe(hashSeed('music:lesson-1'))
    expect(hashSeed('music:lesson-1')).not.toBe(hashSeed('music:lesson-2'))
  })

  it('returns an unsigned 32-bit integer', () => {
    const seed = hashSeed('Clair de lune')
    expect(Number.isInteger(seed)).toBe(true)
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThan(2 ** 32)
  })
})

describe('shuffle', () => {
  const items = ['bach', 'vivaldi', 'mozart', 'beethoven', 'chopin', 'debussy']

  it('returns a permutation without mutating the input', () => {
    const copy = [...items]
    const result = shuffle(items, createRng(3))
    expect(items).toEqual(copy)
    expect([...result].sort()).toEqual([...items].sort())
  })

  it('is deterministic for a given seed', () => {
    expect(shuffle(items, createRng(9))).toEqual(shuffle(items, createRng(9)))
  })

  it('actually reorders across seeds', () => {
    const orders = new Set(
      Array.from({ length: 20 }, (_, seed) => shuffle(items, createRng(seed)).join()),
    )
    expect(orders.size).toBeGreaterThan(10)
  })
})
