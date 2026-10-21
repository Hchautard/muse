import type { CourseIndex } from '../../content/course-index'
import type { Exercise, ExerciseResult } from '../../engine/exercises'

/** Every exercise component gets its exercise and reports one result. */
export interface ExerciseProps<E extends Exercise = Exercise> {
  exercise: E
  content: CourseIndex
  onAnswer: (result: ExerciseResult) => void
}

export interface MediaCredit {
  credit: string
  license: string
  sourceUrl: string
}
