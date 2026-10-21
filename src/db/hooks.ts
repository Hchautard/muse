// Live views of the learner's progress for the screens.
import type { CardRecord } from '../engine/cards'
import type { CourseId } from '../schemas/content'
import {
  completedLessonIds,
  dueCount,
  exportProgress,
  loadCourseCards,
  statsData,
  todayStats,
  type TodayStats,
} from './progress'
import { loadSettings, type Settings } from './settings'
import { useLiveQuery } from './useLiveQuery'

export const useCompletedLessons = (courseId: CourseId): Set<string> | undefined =>
  useLiveQuery(() => completedLessonIds(courseId), `completed:${courseId}`)

/** Cards due today; counted when the screen opens and whenever progress changes. */
export const useDueCount = (courseId: CourseId): number | undefined =>
  useLiveQuery(() => dueCount(courseId), `due:${courseId}`)

/** Today's tally, the streak, and the days since `since` (a "YYYY-MM-DD" day). */
export const useTodayStats = (since: string): TodayStats | undefined =>
  useLiveQuery(() => todayStats(new Date(), since), `today:${since}`)

export const useSettings = (): Settings | undefined => useLiveQuery(loadSettings, 'settings')

export const useCourseCards = (courseId: CourseId): CardRecord[] | undefined =>
  useLiveQuery(() => loadCourseCards(courseId), `cards:${courseId}`)

/** Days, cards and the review log since `since` (an ISO instant, as the key of the query). */
export const useStatsData = (since: string) =>
  useLiveQuery(() => statsData(new Date(since)), `stats:${since}`)

/** The whole progress, kept ready so that sharing the file can happen right in the tap. */
export const useProgressData = () => useLiveQuery(exportProgress, 'progress')
