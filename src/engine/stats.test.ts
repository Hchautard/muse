import { describe, expect, it } from 'vitest'
import { daysBetween } from './calendar'
import { cardLevel, countByLevel, longestStreak, weakPoints, xpHistory } from './stats'
import type { DayStats } from './streak'
import { makeCard } from './test-fixtures'

const day = (date: string, sessions = 1, xp = 50, goal = 1): DayStats => ({
  date,
  xp,
  minutes: 4,
  sessions,
  goal,
})

describe('calendar', () => {
  it('counts the days between two local days, across months and years', () => {
    expect(daysBetween('2026-10-21', '2026-10-21')).toBe(0)
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2026-03-30', '2026-03-28')).toBe(-2)
  })
})

describe('XP history', () => {
  it('lists the last 30 days, today last, with empty days at 0', () => {
    const history = xpHistory(
      [day('2026-10-21', 2, 80), day('2026-10-01'), day('2026-09-01')],
      '2026-10-21',
    )
    expect(history).toHaveLength(30)
    expect(history[0]?.date).toBe('2026-09-22')
    expect(history.at(-1)).toEqual({ date: '2026-10-21', xp: 80, goalMet: true })
    expect(history.find((d) => d.date === '2026-10-01')?.xp).toBe(50)
    expect(history.find((d) => d.date === '2026-10-02')).toEqual({
      date: '2026-10-02',
      xp: 0,
      goalMet: false,
    })
    expect(history.reduce((sum, d) => sum + d.xp, 0)).toBe(130)
  })
})

describe('longest streak', () => {
  it('finds the longest run of days with the goal reached', () => {
    const days = [
      day('2026-10-01'),
      day('2026-10-02'),
      day('2026-10-03'),
      day('2026-10-05'),
      day('2026-10-06'),
      // Two sessions short of a goal of 3: the run stops here.
      day('2026-10-07', 1, 50, 3),
    ]
    expect(longestStreak(days)).toBe(3)
    expect(longestStreak([])).toBe(0)
  })

  it('follows the run across the end of a month', () => {
    expect(longestStreak([day('2026-11-01'), day('2026-10-31'), day('2026-10-30')])).toBe(3)
  })
})

describe('card levels', () => {
  const at = new Date(2026, 9, 1)
  const withStability = (stability: number) => {
    const card = makeCard('bach-1', 'audio-to-composer', at)
    return { ...card, fsrs: { ...card.fsrs, stability } }
  }

  it('sorts cards by the stability of their memory', () => {
    expect(cardLevel(withStability(0.5))).toBe('learning')
    expect(cardLevel(withStability(7))).toBe('consolidating')
    expect(cardLevel(withStability(21))).toBe('mastered')
    expect(countByLevel([withStability(1), withStability(3), withStability(30)])).toEqual({
      learning: 2,
      consolidating: 0,
      mastered: 1,
    })
  })
})

describe('weak points', () => {
  const at = (date: number) => new Date(2026, 9, date)

  it('counts confusions both ways round, most frequent first', () => {
    const confusions = weakPoints([
      { answeredAt: at(1), correct: false, expectedId: 'bach', chosenId: 'vivaldi' },
      { answeredAt: at(2), correct: false, expectedId: 'vivaldi', chosenId: 'bach' },
      { answeredAt: at(3), correct: false, expectedId: 'debussy', chosenId: 'ravel' },
      { answeredAt: at(4), correct: true, expectedId: 'mozart', chosenId: 'mozart' },
    ])
    expect(confusions).toEqual([
      { ids: ['bach', 'vivaldi'], count: 2, lastAt: at(2) },
      { ids: ['debussy', 'ravel'], count: 1, lastAt: at(3) },
    ])
  })

  it('includes the wrong pairings of associations', () => {
    const confusions = weakPoints([
      {
        answeredAt: at(5),
        correct: false,
        mismatches: [
          { expectedId: 'chopin', chosenId: 'tchaikovski' },
          { expectedId: 'tchaikovski', chosenId: 'chopin' },
        ],
      },
    ])
    expect(confusions).toEqual([{ ids: ['chopin', 'tchaikovski'], count: 2, lastAt: at(5) }])
  })

  it('ignores answers without a wrong pick, and old ones', () => {
    const logs = [
      // A chronology or a statement rejected by mistake: nothing was picked instead.
      { answeredAt: at(6), correct: false, expectedId: 'bach' },
      { answeredAt: at(1), correct: false, expectedId: 'bach', chosenId: 'vivaldi' },
    ]
    expect(weakPoints(logs, { since: at(2) })).toEqual([])
    expect(weakPoints(logs)).toHaveLength(1)
  })

  it('keeps the most frequent pairs only', () => {
    const logs = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) => ({
      answeredAt: at(i + 1),
      correct: false,
      expectedId: 'x',
      chosenId: id,
    }))
    expect(weakPoints(logs, { limit: 3 }).map((c) => c.ids[0])).toEqual(['g', 'f', 'e'])
  })
})
