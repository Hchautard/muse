import type { CourseIndex } from '../../content/course-index'
import { exerciseMediaIds, type Exercise } from '../../engine/exercises'
import { SKILL_SPECS } from '../../engine/skills'
import type { MediaAsset } from '../../schemas/content'

export interface FeedbackPair {
  answer: string
  title: string
}

export interface Feedback {
  answerLabel: string
  title: string
  summary: string
  credits: MediaAsset[]
  prefixAnswer: boolean
  /** Association: every pair, in the order of the exercise's first column. */
  pairs?: FeedbackPair[]
}

/** What the feedback sheet shows after an answer: the right answer, the work and its credit. */
export function feedbackFor(exercise: Exercise, content: CourseIndex): Feedback {
  const work = content.entity(exercise.entityId)
  const summary = work?.summary ?? ''
  const credits = exerciseMediaIds(exercise, content)
    .map((id) => content.asset(id))
    .filter((asset) => asset !== undefined)

  switch (exercise.kind) {
    case 'chronology':
      // The exercise itself shows the right order and the years.
      return {
        answerLabel: work?.name ?? '',
        title: work?.year !== undefined ? String(work.year) : '',
        summary,
        credits,
        prefixAnswer: false,
      }
    case 'association': {
      const concepts = SKILL_SPECS[exercise.skill].subject === 'concept'
      const pairs = exercise.leftIds.map((id) => {
        const left = content.entity(id)
        const right = content.entity(exercise.pairs[id] ?? '')
        // Concepts: name and full definition; works: answer and title.
        return concepts
          ? { answer: left?.name ?? '', title: left?.summary ?? '' }
          : { answer: right?.name ?? '', title: left?.name ?? '' }
      })
      return { answerLabel: '', title: '', summary: '', credits, prefixAnswer: false, pairs }
    }
    default:
      return {
        answerLabel: content.entity(exercise.answerId)?.name ?? '',
        title: work?.name ?? '',
        summary,
        credits,
        prefixAnswer: true,
      }
  }
}
