// Reads and writes of the learner's progress. The rules live in src/engine; this file only
// moves data in and out of IndexedDB.
import { localDay } from '../engine/calendar'
import { dueCards, type CardRecord } from '../engine/cards'
import { applyAnswers } from '../engine/review'
import { summarizeRun, type SessionRun, type SessionSummary } from '../engine/run'
import type { SessionMode } from '../engine/session'
import { addSession, currentStreak, DEFAULT_DAILY_GOAL, type DayStats } from '../engine/streak'
import type { CourseId } from '../schemas/content'
import { db } from './db'

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

export async function dailyGoal(): Promise<number> {
  const setting = await db.settings.get('dailyGoal')
  return typeof setting?.value === 'number' ? setting.value : DEFAULT_DAILY_GOAL
}

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
