// Exercise shapes and how one card becomes an exercise.
import type { CourseIndex } from '../content/course-index'
import type { Skill } from '../schemas/content'
import type { CardKey } from './cards'
import { pickDistractors } from './distractors'
import { shuffle, type Rng } from './random'
import { SKILL_SPECS, skillAnswer, skillApplies } from './skills'

export type ExerciseKind = 'audio-choice' | 'image-choice' | 'true-false' | 'chronology'
export type Modality = 'audio' | 'image' | 'text'

interface ExerciseBase {
  /** Unique within a session. */
  id: string
  cardId: string
  /** The work the exercise is about. */
  entityId: string
  skill: Skill
  /** Rated with FSRS. Rework and retries are practice only. */
  graded: boolean
  /** First encounter: the work is presented just before the question. */
  intro: boolean
  /** Second chance, at the end of the session, at a card missed earlier. */
  retry: boolean
}

/** Four-choice question on an excerpt or an image. Options and answer are entity ids. */
export interface ChoiceExercise extends ExerciseBase {
  kind: 'audio-choice' | 'image-choice'
  mediaId: string
  optionIds: string[]
  answerId: string
}

/** "This excerpt is by <claim>": true when the claim is the real answer. */
export interface TrueFalseExercise extends ExerciseBase {
  kind: 'true-false'
  mediaId: string
  claimId: string
  answerId: string
}

/** Put three or four works in chronological order. */
export interface ChronologyExercise extends ExerciseBase {
  kind: 'chronology'
  /** Display order. */
  itemIds: string[]
  /** Oldest first. */
  answerIds: string[]
}

export type Exercise = ChoiceExercise | TrueFalseExercise | ChronologyExercise

export interface ExerciseResult {
  correct: boolean
  durationMs: number
  /** Entity the learner picked (or accepted as true), to find what gets confused with what. */
  chosenId?: string
}

/** The exercise kinds that practise a skill: the main one first. */
const KINDS: Partial<Record<Skill, ExerciseKind[]>> = {
  'audio-to-composer': ['audio-choice', 'true-false'],
  'audio-to-period': ['audio-choice', 'true-false'],
  'image-to-artist': ['image-choice', 'true-false'],
  'image-to-movement': ['image-choice', 'true-false'],
  'work-to-date': ['chronology'],
}

/** Below this mastery a card is always asked with its main kind (a four-choice question). */
const TRUE_FALSE_MIN_MASTERY = 0.3
const TRUE_FALSE_SHARE = 0.35
/** From this mastery on, a chronology has four works instead of three. */
const LONG_CHRONOLOGY_MASTERY = 0.5

export function modalityOf(exercise: Exercise): Modality {
  if (exercise.kind === 'chronology') return 'text'
  return SKILL_SPECS[exercise.skill]?.media ?? 'text'
}

export const isSensory = (exercise: Exercise) => modalityOf(exercise) !== 'text'

export interface ExerciseRequest {
  id: string
  card: CardKey
  graded: boolean
  intro: boolean
  /** 0 for a new card, up to 1 for a mastered one. */
  mastery: number
}

export interface ExerciseContext {
  content: CourseIndex
  rng: Rng
  encountered: ReadonlySet<string>
}

function chooseKind(skill: Skill, mastery: number, intro: boolean, rng: Rng): ExerciseKind {
  const [main, alternative] = KINDS[skill] ?? []
  if (!main) throw new Error(`No exercise for skill ${skill}`)
  if (!alternative || intro || mastery < TRUE_FALSE_MIN_MASTERY) return main
  return rng() < TRUE_FALSE_SHARE ? alternative : main
}

/** Builds one exercise for a card, or returns undefined when the content cannot support it. */
export function buildExercise(
  request: ExerciseRequest,
  { content, rng, encountered }: ExerciseContext,
): Exercise | undefined {
  const { card, mastery } = request
  const entity = content.entity(card.entityId)
  if (!entity || !skillApplies(content, entity, card.skill)) return undefined
  const answer = skillAnswer(content, entity, card.skill)
  if (!answer) return undefined

  const base = {
    id: request.id,
    cardId: card.id,
    entityId: entity.id,
    skill: card.skill,
    graded: request.graded,
    intro: request.intro,
    retry: false,
  }
  const kind = chooseKind(card.skill, mastery, request.intro, rng)

  if (kind === 'chronology') {
    const count = mastery >= LONG_CHRONOLOGY_MASTERY ? 3 : 2
    const others = pickDistractors(entity, card.skill, content, mastery, {
      rng,
      encountered,
      count,
    })
    if (others.length < 2) return undefined
    const works = [entity, ...others]
    const answerIds = [...works].sort((a, b) => (a.year ?? 0) - (b.year ?? 0)).map((w) => w.id)
    return { ...base, kind, itemIds: shuffleOutOfOrder(answerIds, rng), answerIds }
  }

  const mediaKind = SKILL_SPECS[card.skill]?.media
  const media = mediaKind ? content.media(entity, mediaKind) : undefined
  if (!media) return undefined

  if (kind === 'true-false') {
    const truthful = rng() < 0.5
    const [falseClaim] = truthful
      ? []
      : pickDistractors(answer, card.skill, content, mastery, { rng, encountered, count: 1 })
    return {
      ...base,
      kind,
      mediaId: media.id,
      claimId: falseClaim?.id ?? answer.id,
      answerId: answer.id,
    }
  }

  const distractors = pickDistractors(answer, card.skill, content, mastery, { rng, encountered })
  if (distractors.length === 0) return undefined
  return {
    ...base,
    kind,
    mediaId: media.id,
    optionIds: shuffle([answer, ...distractors], rng).map((e) => e.id),
    answerId: answer.id,
  }
}

/** Shuffles works for a chronology, never handing out the solution. */
export function shuffleOutOfOrder(answerIds: readonly string[], rng: Rng): string[] {
  const itemIds = shuffle(answerIds, rng)
  const solved = itemIds.every((id, i) => id === answerIds[i])
  return solved && itemIds.length > 1 ? [...itemIds.slice(1), itemIds[0]!] : itemIds
}

/** Correct answer of an exercise, for feedback and review logs (undefined for a chronology). */
export function expectedAnswerId(exercise: Exercise): string | undefined {
  return exercise.kind === 'chronology' ? undefined : exercise.answerId
}
