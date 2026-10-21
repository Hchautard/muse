import { useSettings } from '../db/hooks'
import { saveSetting } from '../db/settings'
import type { CourseId } from '../schemas/content'

/**
 * The course shown on the home and collection screens: the last one chosen, kept in the settings,
 * or the first one. Undefined until the settings are read.
 */
export function useChosenCourse(
  courses: readonly { id: CourseId }[],
): [CourseId | undefined, (courseId: CourseId) => void] {
  const settings = useSettings()
  const chosen = settings?.course
  const courseId =
    settings === undefined
      ? undefined
      : chosen && courses.some((c) => c.id === chosen)
        ? chosen
        : courses[0]?.id
  return [courseId, (id) => void saveSetting('course', id)]
}
