import { describe, expect, it } from 'vitest'
import { addDays, localDay, startOfNextDay } from './calendar'
import { addSession, currentStreak, isGoalMet, type DayStats } from './streak'

const day = (date: string, sessions = 1, goal = 1): DayStats => ({
  date,
  xp: sessions * 50,
  minutes: sessions * 4,
  sessions,
  goal,
})

describe('calendar', () => {
  it('uses the local day, so midnight separates two days', () => {
    expect(localDay(new Date(2026, 9, 21, 23, 59))).toBe('2026-10-21')
    expect(localDay(new Date(2026, 9, 22, 0, 1))).toBe('2026-10-22')
  })

  it('shifts days across months, years and daylight saving changes', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-25', -1)).toBe('2026-10-24')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('finds the start of the next local day', () => {
    expect(startOfNextDay(new Date(2026, 9, 21, 15))).toEqual(new Date(2026, 9, 22))
  })
})

describe('currentStreak', () => {
  it('counts consecutive days up to today', () => {
    const days = [day('2026-10-19'), day('2026-10-20'), day('2026-10-21')]
    expect(currentStreak(days, '2026-10-21')).toBe(3)
  })

  it('keeps yesterday’s streak while today is still open', () => {
    const days = [day('2026-10-19'), day('2026-10-20')]
    expect(currentStreak(days, '2026-10-21')).toBe(2)
  })

  it('resets after a missed day', () => {
    const days = [day('2026-10-17'), day('2026-10-18'), day('2026-10-20')]
    expect(currentStreak(days, '2026-10-20')).toBe(1)
    expect(currentStreak(days, '2026-10-21')).toBe(1)
    expect(currentStreak(days, '2026-10-22')).toBe(0)
  })

  it('counts a day only when its goal is reached', () => {
    const days = [day('2026-10-19', 2, 2), day('2026-10-20', 1, 2), day('2026-10-21', 3, 2)]
    expect(currentStreak(days, '2026-10-21')).toBe(1)
  })

  it('follows the local calendar across midnight', () => {
    let days: DayStats[] = []
    const record = (at: Date) => {
      const date = localDay(at)
      const today = days.find((d) => d.date === date)
      days = [
        ...days.filter((d) => d !== today),
        addSession(today, date, { xp: 10, minutes: 3 }, 1),
      ]
    }
    record(new Date(2026, 9, 20, 23, 58))
    record(new Date(2026, 9, 21, 0, 2))
    expect(days.map((d) => d.date).sort()).toEqual(['2026-10-20', '2026-10-21'])
    expect(currentStreak(days, localDay(new Date(2026, 9, 21, 12)))).toBe(2)
  })

  it('is 0 without any activity', () => {
    expect(currentStreak([], '2026-10-21')).toBe(0)
  })
})

describe('addSession', () => {
  it('accumulates XP, minutes and sessions, and records the goal in force', () => {
    const first = addSession(undefined, '2026-10-21', { xp: 95, minutes: 4.5 }, 2)
    expect(first).toEqual({ date: '2026-10-21', xp: 95, minutes: 4.5, sessions: 1, goal: 2 })
    expect(isGoalMet(first)).toBe(false)
    const second = addSession(first, '2026-10-21', { xp: 40, minutes: 3 }, 2)
    expect(second).toMatchObject({ xp: 135, minutes: 7.5, sessions: 2 })
    expect(isGoalMet(second)).toBe(true)
  })
})
