// Daily goal and streak. A day counts when its goal (a number of sessions) is reached.
import { addDays } from './calendar'

export const DEFAULT_DAILY_GOAL = 1

export interface DayStats {
  /** Local day, "YYYY-MM-DD". */
  date: string
  xp: number
  minutes: number
  sessions: number
  /** Goal in force that day, so that changing it later does not rewrite the past. */
  goal: number
}

export function isGoalMet(day: DayStats | undefined): boolean {
  return day !== undefined && day.sessions >= day.goal
}

/** Adds a finished session to the day's tally (creating the day if needed). */
export function addSession(
  day: DayStats | undefined,
  date: string,
  session: { xp: number; minutes: number },
  goal: number,
): DayStats {
  return {
    date,
    xp: (day?.xp ?? 0) + session.xp,
    minutes: (day?.minutes ?? 0) + session.minutes,
    sessions: (day?.sessions ?? 0) + 1,
    goal,
  }
}

/** Adds XP earned outside a session (the daily challenge): the session count is unchanged. */
export function addXp(day: DayStats | undefined, date: string, xp: number, goal: number): DayStats {
  return {
    date,
    xp: (day?.xp ?? 0) + xp,
    minutes: day?.minutes ?? 0,
    sessions: day?.sessions ?? 0,
    goal: day?.goal ?? goal,
  }
}

/**
 * Consecutive days with the goal reached, ending today, or yesterday while today is still in
 * progress: the streak only breaks once a whole day has passed without reaching the goal.
 */
export function currentStreak(days: readonly DayStats[], today: string): number {
  const byDate = new Map(days.map((day) => [day.date, day]))
  let day = isGoalMet(byDate.get(today)) ? today : addDays(today, -1)
  let streak = 0
  while (isGoalMet(byDate.get(day))) {
    streak++
    day = addDays(day, -1)
  }
  return streak
}
