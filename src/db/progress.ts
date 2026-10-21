// Reads and writes of the learner's progress. The rules live in src/engine; this file only
// moves data in and out of IndexedDB.
import { localDay } from '../engine/calendar'
import { dueCards, type CardRecord } from '../engine/cards'
import { applyAnswers } from '../engine/review'
import { summarizeRun, type SessionRun, type SessionSummary } from '../engine/run'
import type { SessionMode } from '../engine/session'
import { addSession, currentStreak, type DayStats } from '../engine/streak'
import type { CourseId } from '../schemas/content'
import type { ProgressData } from './backup'
import { db } from './db'
import { loadSettings } from './settings'

/** Longer sessions were most likely left open: they count for this many minutes at most. */
const MAX_SESSION_MINUTES = 30

export const loadCourseCards = (courseId: CourseId): Promise<CardRecord[]> =>
  db.cards.where('courseId').equals(courseId).toArray()

export async function completedLessonIds(courseId: CourseId): Promise<Set<string>> {
  const lessons = await db.lessons.where('courseId').equals(courseId).toArray()
  return new Set(lessons.map((l) => l.lessonId))
}

export async function dueCount(courseId: CourseId, now = new Date()): Promise<number> {
  return dueCards(await loadCourseCards(courseId), now).length
}

const dailyGoal = async () => (await loadSettings()).dailyGoal

export interface TodayStats {
  today: DayStats | undefined
  goal: number
  streak: number
  /** The last days, oldest first, from `since` to today. */
  days: DayStats[]
}

export async function todayStats(now = new Date(), since?: string): Promise<TodayStats> {
  const [days, goal] = await Promise.all([db.daily.toArray(), dailyGoal()])
  const today = localDay(now)
  return {
    today: days.find((d) => d.date === today),
    goal,
    streak: currentStreak(days, today),
    days: since ? days.filter((d) => d.date >= since && d.date <= today) : [],
  }
}

export interface FinishedSession {
  courseId: CourseId
  mode: SessionMode
  run: SessionRun
  startedAt: Date
  finishedAt: Date
}

/**
 * Stores a finished session in one transaction: FSRS schedule of the graded cards, review log,
 * lesson completion and the day's tally. An abandoned session stores nothing.
 */
export async function saveSession(session: FinishedSession): Promise<SessionSummary> {
  const { courseId, mode, run, startedAt, finishedAt } = session
  const summary = summarizeRun(run, { lessonCompleted: mode.type === 'lesson' })
  const minutes = Math.min(
    MAX_SESSION_MINUTES,
    (finishedAt.getTime() - startedAt.getTime()) / 60_000,
  )

  await db.transaction(
    'rw',
    [db.cards, db.reviewLog, db.lessons, db.daily, db.settings],
    async () => {
      const ids = [
        ...new Set(run.answers.filter((a) => a.exercise.graded).map((a) => a.exercise.cardId)),
      ]
      const existing = (await db.cards.bulkGet(ids)).filter((c) => c !== undefined)
      const { cards, reviews } = applyAnswers(
        courseId,
        new Map(existing.map((c) => [c.id, c])),
        run.answers,
      )
      await db.cards.bulkPut(cards)
      await db.reviewLog.bulkAdd(reviews.map((review) => ({ ...review, courseId })))

      if (mode.type === 'lesson') {
        const previous = await db.lessons.get(mode.lessonId)
        await db.lessons.put({
          lessonId: mode.lessonId,
          courseId,
          completedAt: previous?.completedAt ?? finishedAt,
          bestScore: Math.max(previous?.bestScore ?? 0, summary.accuracy),
        })
      }

      const date = localDay(finishedAt)
      const day = await db.daily.get(date)
      await db.daily.put(
        addSession(day, date, { xp: summary.xp.total, minutes }, await dailyGoal()),
      )
    },
  )
  return summary
}

const progressTables = () => [db.cards, db.reviewLog, db.lessons, db.daily]

/** Every table, read in one transaction so that the copy is consistent. */
export function exportProgress(): Promise<ProgressData> {
  return db.transaction('r', [...progressTables(), db.settings], async () => ({
    cards: await db.cards.toArray(),
    reviewLog: await db.reviewLog.toArray(),
    lessons: await db.lessons.toArray(),
    daily: await db.daily.toArray(),
    settings: await db.settings.toArray(),
  }))
}

/** Replaces everything (settings included) with the content of a backup. */
export async function importProgress(data: ProgressData): Promise<void> {
  await db.transaction('rw', [...progressTables(), db.settings], async () => {
    await Promise.all([...progressTables(), db.settings].map((table) => table.clear()))
    await db.cards.bulkAdd(data.cards)
    await db.reviewLog.bulkAdd(data.reviewLog)
    await db.lessons.bulkAdd(data.lessons)
    await db.daily.bulkAdd(data.daily)
    await db.settings.bulkAdd(data.settings)
  })
}

/** Erases the progress (cards, history, lessons, days); settings are kept. */
export async function resetProgress(): Promise<void> {
  await db.transaction('rw', progressTables(), async () => {
    await Promise.all(progressTables().map((table) => table.clear()))
  })
}

/** Everything the statistics screen needs; the review log only from `since` on. */
export async function statsData(since: Date) {
  const [days, cards, logs] = await Promise.all([
    db.daily.toArray(),
    db.cards.toArray(),
    db.reviewLog.where('answeredAt').aboveOrEqual(since).toArray(),
  ])
  return { days, cards, logs }
}
