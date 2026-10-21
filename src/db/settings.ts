// The learner's settings, stored as key/value rows.
import { localDay } from '../engine/calendar'
import { DEFAULT_DAILY_GOAL } from '../engine/streak'
import { COURSE_IDS, type CourseId } from '../schemas/content'
import { db } from './db'

export interface Settings {
  /** Sessions a day. */
  dailyGoal: number
  /** Sound effects after answers (the excerpts always play). */
  sound: boolean
  /** Course last chosen on the home or collection screen. */
  course?: CourseId
}

export const DEFAULT_SETTINGS: Settings = { dailyGoal: DEFAULT_DAILY_GOAL, sound: true }

export const DAILY_GOALS = [1, 2, 3, 5]

const isValid: { [K in keyof Settings]-?: (value: unknown) => value is NonNullable<Settings[K]> } =
  {
    dailyGoal: (value): value is number =>
      typeof value === 'number' && Number.isInteger(value) && value > 0,
    sound: (value): value is boolean => typeof value === 'boolean',
    course: (value): value is CourseId => (COURSE_IDS as readonly unknown[]).includes(value),
  }

export async function loadSettings(): Promise<Settings> {
  const rows = await db.settings.toArray()
  const settings = { ...DEFAULT_SETTINGS }
  for (const { key, value } of rows) {
    if (key === 'dailyGoal' && isValid.dailyGoal(value)) settings.dailyGoal = value
    if (key === 'sound' && isValid.sound(value)) settings.sound = value
    if (key === 'course' && isValid.course(value)) settings.course = value
  }
  return settings
}

export async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await db.settings.put({ key, value })
}

/**
 * Changes the daily goal from today on: today's tally follows the new goal, past days keep the
 * goal they had.
 */
export async function setDailyGoal(goal: number, now = new Date()) {
  await db.transaction('rw', [db.settings, db.daily], async () => {
    await saveSetting('dailyGoal', goal)
    const today = localDay(now)
    if (await db.daily.get(today)) await db.daily.update(today, { goal })
  })
}
