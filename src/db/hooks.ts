// Live views of the learner's progress for the screens.
import type { CourseId } from '../schemas/content'
import { completedLessonIds, dueCount, todayStats, type TodayStats } from './progress'
import { useLiveQuery } from './useLiveQuery'

export const useCompletedLessons = (courseId: CourseId): Set<string> | undefined =>
  useLiveQuery(() => completedLessonIds(courseId), `completed:${courseId}`)

/** Cards due today; counted when the screen opens and whenever progress changes. */
export const useDueCount = (courseId: CourseId): number | undefined =>
  useLiveQuery(() => dueCount(courseId), `due:${courseId}`)

/** Today's tally, the streak, and the days since `since` (a "YYYY-MM-DD" day). */
export const useTodayStats = (since: string): TodayStats | undefined =>
  useLiveQuery(() => todayStats(new Date(), since), `today:${since}`)
