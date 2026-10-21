import type { CourseIndex } from '../../content/course-index'
import type { Exercise } from '../../engine/exercises'
import type { MediaAsset } from '../../schemas/content'

export interface Feedback {
  answerLabel: string
  title: string
  summary: string
  credit?: MediaAsset
  prefixAnswer: boolean
}

/** What the feedback sheet shows after an answer: the right answer, the work and its credit. */
export function feedbackFor(exercise: Exercise, content: CourseIndex): Feedback {
  const work = content.entity(exercise.entityId)
  const summary = work?.summary ?? ''
  if (exercise.kind === 'chronology') {
    // The exercise itself shows the right order and the years.
    return {
      answerLabel: work?.name ?? '',
      title: work?.year !== undefined ? String(work.year) : '',
      summary,
      prefixAnswer: false,
    }
  }
  return {
    answerLabel: content.entity(exercise.answerId)?.name ?? '',
    title: work?.name ?? '',
    summary,
    credit: content.asset(exercise.mediaId),
    prefixAnswer: true,
  }
}
