// Exercise shapes and how one card becomes an exercise.
import type { CourseIndex } from '../content/course-index'
import type { Entity, Skill } from '../schemas/content'
import type { CardKey } from './cards'
import { pickDistractors } from './distractors'
import { shuffle, type Rng } from './random'
import { SKILL_SPECS, skillAnswer, skillApplies } from './skills'

export const EXERCISE_KINDS = [
  'audio-choice',
  'image-choice',
  'detail',
  'true-false',
  'chronology',
  'association',
] as const
export type ExerciseKind = (typeof EXERCISE_KINDS)[number]
export type Modality = 'audio' | 'image' | 'text'

interface ExerciseBase {
  /** Unique within a session. */
  id: string
  cardId: string
  /** The work (or concept) the exercise is about. */
  entityId: string
  skill: Skill
  /** Rated with FSRS. Rework and retries are practice only. */
  graded: boolean
  /** First encounter: the work is presented just before the question. */
  intro: boolean
  /** Second chance, at the end of the session, at a card missed earlier. */
  retry: boolean
}

interface ChoiceFields {
  mediaId: string
  /** Entity ids, in display order. */
  optionIds: string[]
  answerId: string
}

/** Four-choice question on an excerpt or an image. */
export interface ChoiceExercise extends ExerciseBase, ChoiceFields {
  kind: 'audio-choice' | 'image-choice'
}

/** Four-choice question on a close-up: only part of the painting is visible. */
export interface DetailExercise extends ExerciseBase, ChoiceFields {
  kind: 'detail'
  /** Zoom centre, as fractions of the image's width and height, and magnification. */
  crop: { x: number; y: number; zoom: number }
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

/**
 * Match four pairs by taps: works (heard or seen) with their composer, period…, or concepts with
 * their definition.
 */
export interface AssociationExercise extends ExerciseBase {
  kind: 'association'
  /** Works or concepts, in display order. */
  leftIds: string[]
  /** Their answers, or the concepts again (shown by their definition), in display order. */
  rightIds: string[]
  /** Expected right id for each left id. */
  pairs: Record<string, string>
}

export type Exercise =
  ChoiceExercise | DetailExercise | TrueFalseExercise | ChronologyExercise | AssociationExercise

/** A wrong pick: what was expected and what the learner chose instead. */
export interface Mismatch {
  expectedId: string
  chosenId: string
}

export interface ExerciseResult {
  correct: boolean
  durationMs: number
  /** Entity the learner picked (or accepted as true), to find what gets confused with what. */
  chosenId?: string
  /** Association: every wrong pairing tried before finding the right ones. */
  mismatches?: Mismatch[]
}

interface Alternative {
  kind: ExerciseKind
  /** Below this mastery the card is asked with its main kind. */
  minMastery: number
  /** Share of the questions, once the mastery is reached. */
  share: number
}

const AUDIO_ALTERNATIVES: Alternative[] = [
  { kind: 'true-false', minMastery: 0.3, share: 0.35 },
  { kind: 'association', minMastery: 0.5, share: 0.2 },
]
const IMAGE_ALTERNATIVES: Alternative[] = [
  { kind: 'true-false', minMastery: 0.3, share: 0.25 },
  { kind: 'detail', minMastery: 0.5, share: 0.25 },
  { kind: 'association', minMastery: 0.5, share: 0.15 },
]

/** The kinds that practise a skill: the main one (always used for a new card) and the others. */
const KINDS: Record<Skill, { main: ExerciseKind; alternatives: Alternative[] }> = {
  'audio-to-composer': { main: 'audio-choice', alternatives: AUDIO_ALTERNATIVES },
  'audio-to-period': { main: 'audio-choice', alternatives: AUDIO_ALTERNATIVES },
  'image-to-artist': { main: 'image-choice', alternatives: IMAGE_ALTERNATIVES },
  'image-to-movement': { main: 'image-choice', alternatives: IMAGE_ALTERNATIVES },
  'work-to-date': { main: 'chronology', alternatives: [] },
  'concept-definition': { main: 'association', alternatives: [] },
}

/** From this mastery on, a chronology has four works instead of three. */
const LONG_CHRONOLOGY_MASTERY = 0.5
const ASSOCIATION_PAIRS = 4
const DETAIL_ZOOM = 2.5
/** Close-ups are centred in the middle part of the painting, where its subject usually is. */
const DETAIL_MARGIN = 0.25

export function modalityOf(exercise: Exercise): Modality {
  if (exercise.kind === 'chronology') return 'text'
  return SKILL_SPECS[exercise.skill].media ?? 'text'
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
  const { main, alternatives } = KINDS[skill]
  const eligible = alternatives.filter((a) => mastery >= a.minMastery)
  if (intro || eligible.length === 0) return main
  const draw = rng()
  let threshold = 0
  for (const alternative of eligible) {
    threshold += alternative.share
    if (draw < threshold) return alternative.kind
  }
  return main
}

/**
 * Builds one exercise for a card, or returns undefined when the content cannot support it. An
 * alternative kind that the content cannot support (too few pairs…) falls back to the main one.
 */
export function buildExercise(
  request: ExerciseRequest,
  context: ExerciseContext,
): Exercise | undefined {
  const { card, mastery } = request
  const { content, rng } = context
  const entity = content.entity(card.entityId)
  if (!entity || !skillApplies(content, entity, card.skill)) return undefined

  const base: ExerciseBase = {
    id: request.id,
    cardId: card.id,
    entityId: entity.id,
    skill: card.skill,
    graded: request.graded,
    intro: request.intro,
    retry: false,
  }
  const kind = chooseKind(card.skill, mastery, request.intro, rng)
  const exercise = buildKind(kind, base, entity, mastery, context)
  const { main } = KINDS[card.skill]
  return exercise ?? (kind === main ? undefined : buildKind(main, base, entity, mastery, context))
}

function buildKind(
  kind: ExerciseKind,
  base: ExerciseBase,
  entity: Entity,
  mastery: number,
  context: ExerciseContext,
): Exercise | undefined {
  const { content, rng, encountered } = context
  const { skill } = base

  if (kind === 'chronology') {
    const count = mastery >= LONG_CHRONOLOGY_MASTERY ? 3 : 2
    const others = pickDistractors(entity, skill, content, mastery, { rng, encountered, count })
    if (others.length < 2) return undefined
    const works = [entity, ...others]
    const answerIds = [...works].sort((a, b) => (a.year ?? 0) - (b.year ?? 0)).map((w) => w.id)
    return { ...base, kind, itemIds: shuffleOutOfOrder(answerIds, rng), answerIds }
  }

  if (kind === 'association') return association(base, entity, mastery, context)

  const answer = skillAnswer(content, entity, skill)
  const mediaKind = SKILL_SPECS[skill].media
  const media = mediaKind ? content.media(entity, mediaKind) : undefined
  if (!answer || !media) return undefined

  if (kind === 'true-false') {
    const truthful = rng() < 0.5
    const [falseClaim] = truthful
      ? []
      : pickDistractors(answer, skill, content, mastery, { rng, encountered, count: 1 })
    return {
      ...base,
      kind,
      mediaId: media.id,
      claimId: falseClaim?.id ?? answer.id,
      answerId: answer.id,
    }
  }

  const distractors = pickDistractors(answer, skill, content, mastery, { rng, encountered })
  if (distractors.length === 0) return undefined
  const choice: ChoiceFields = {
    mediaId: media.id,
    optionIds: shuffle([answer, ...distractors], rng).map((e) => e.id),
    answerId: answer.id,
  }
  if (kind === 'detail') {
    const span = 1 - 2 * DETAIL_MARGIN
    const crop = {
      x: DETAIL_MARGIN + rng() * span,
      y: DETAIL_MARGIN + rng() * span,
      zoom: DETAIL_ZOOM,
    }
    return { ...base, kind, ...choice, crop }
  }
  return { ...base, kind, ...choice }
}

/**
 * Four pairs around the card's entity. Concepts are matched with their own definition; works with
 * their answer, the three other works being chosen through their answers (close to the right one
 * as the card gets better known), preferably among works already met.
 */
function association(
  base: ExerciseBase,
  entity: Entity,
  mastery: number,
  { content, rng, encountered }: ExerciseContext,
): AssociationExercise | undefined {
  const { skill } = base
  const spec = SKILL_SPECS[skill]
  const all = Number.MAX_SAFE_INTEGER
  const pairs: Record<string, string> = {}

  if (spec.subject === 'concept') {
    const others = pickDistractors(entity, skill, content, mastery, { rng, encountered, count: 3 })
    for (const concept of [entity, ...others]) pairs[concept.id] = concept.id
  } else {
    const relation = spec.answer
    const answer = skillAnswer(content, entity, skill)
    if (!relation || !answer) return undefined
    pairs[entity.id] = answer.id
    const candidates = pickDistractors(answer, skill, content, mastery, {
      rng,
      encountered,
      count: all,
    })
    for (const other of candidates) {
      if (Object.keys(pairs).length === ASSOCIATION_PAIRS) break
      const works = content.bundle.relations
        .filter((r) => r.type === relation && r.to === other.id && r.from !== entity.id)
        .map((r) => content.entity(r.from))
        .filter(
          (w): w is Entity =>
            w !== undefined &&
            content.related(w.id, relation)?.id === other.id &&
            skillApplies(content, w, skill),
        )
        .sort((a, b) => a.id.localeCompare(b.id))
      const met = works.filter((w) => encountered.has(w.id))
      const pool = met.length > 0 ? met : works
      const work = pool[Math.floor(rng() * pool.length)]
      if (work) pairs[work.id] = other.id
    }
  }

  if (Object.keys(pairs).length < ASSOCIATION_PAIRS) return undefined
  return { ...base, kind: 'association', pairs, ...shuffleAssociation(pairs, rng) }
}

/** Display order of both columns, never lined up pair by pair. */
export function shuffleAssociation(
  pairs: Record<string, string>,
  rng: Rng,
): { leftIds: string[]; rightIds: string[] } {
  const leftIds = shuffle(Object.keys(pairs), rng)
  const rightIds = shuffle(Object.values(pairs), rng)
  const lined = leftIds.every((id, i) => pairs[id] === rightIds[i])
  return { leftIds, rightIds: lined ? [...rightIds.slice(1), rightIds[0]!] : rightIds }
}

/** Shuffles works for a chronology, never handing out the solution. */
export function shuffleOutOfOrder(answerIds: readonly string[], rng: Rng): string[] {
  const itemIds = shuffle(answerIds, rng)
  const solved = itemIds.every((id, i) => id === answerIds[i])
  return solved && itemIds.length > 1 ? [...itemIds.slice(1), itemIds[0]!] : itemIds
}

/** Correct answer of a single-answer exercise, for review logs (undefined otherwise). */
export function expectedAnswerId(exercise: Exercise): string | undefined {
  return exercise.kind === 'chronology' || exercise.kind === 'association'
    ? undefined
    : exercise.answerId
}

/** Media an exercise plays or shows, e.g. to fetch them ahead of time. */
export function exerciseMediaIds(exercise: Exercise, content: CourseIndex): string[] {
  switch (exercise.kind) {
    case 'chronology':
      return []
    case 'association': {
      const kind = SKILL_SPECS[exercise.skill].media
      if (!kind) return []
      return exercise.leftIds
        .map((id) => {
          const work = content.entity(id)
          return work && content.media(work, kind)?.id
        })
        .filter((id) => id !== undefined)
    }
    default:
      return [exercise.mediaId]
  }
}
