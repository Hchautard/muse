export type LessonState = 'completed' | 'current' | 'locked'

/**
 * Lessons unlock in order: completed lessons stay open, the first lesson not yet completed is
 * the current one, and every lesson after it is locked.
 */
export function lessonStates(
  lessonIds: readonly string[],
  completed: ReadonlySet<string>,
): Map<string, LessonState> {
  const states = new Map<string, LessonState>()
  let currentFound = false
  for (const id of lessonIds) {
    if (completed.has(id)) states.set(id, 'completed')
    else if (!currentFound) {
      states.set(id, 'current')
      currentFound = true
    } else states.set(id, 'locked')
  }
  return states
}
