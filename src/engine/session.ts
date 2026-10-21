// Builds the list of exercises for a lesson or a review session.
import type { CourseIndex } from '../content/course-index'
import type { CourseId } from '../schemas/content'
import { dueCards, lessonCardKeys, playableCards, type CardKey, type CardRecord } from './cards'
import {
  buildExercise,
  isSensory,
  modalityOf,
  type Exercise,
  type ExerciseRequest,
} from './exercises'
import { mastery } from './fsrs'
import { createRng, hashSeed, type Rng } from './random'
import { SKILL_SPECS } from './skills'

export type SessionMode = { type: 'lesson'; lessonId: string } | { type: 'review' }

export interface BuildSessionInput {
  courseId: CourseId
  mode: SessionMode
  now: Date
  /** The learner's cards; cards of other courses are ignored. */
  cards: readonly CardRecord[]
  content: CourseIndex
  seed?: number
}

/** Target length of a lesson, reached with rework when the lesson and the reviews fall short. */
export const LESSON_LENGTH = 12
/** Due reviews interleaved in a lesson. */
export const LESSON_REVIEWS = { min: 2, max: 4 }
export const REVIEW_LENGTH = 15

/** Rework comes right after the presentation, so it is asked a little harder than a new card. */
const REWORK_MASTERY = 0.35
/** Introductions are spread over the first part of a lesson, rework over the last part. */
const INTRO_SPAN = 0.6
// Ordering costs: being late is urgent; repeating the previous medium or skill is avoided.
const SAME_MODALITY_COST = 2.5
const SAME_SKILL_COST = 1

interface Slot {
  request: Omit<ExerciseRequest, 'id'>
  /** Preferred position in the session. */
  target: number
  /** Slot that must come first: the work's introduction. */
  after?: Slot
  /** Lower goes first when the session has to shed text exercises. */
  keep: number
}

interface BuiltSlot extends Slot {
  exercise: Exercise
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function buildSession(input: BuildSessionInput): Exercise[] {
  const { content, mode, now } = input
  const rng = createRng(input.seed ?? hashSeed(`${JSON.stringify(mode)}@${now.toISOString()}`))
  const cards = playableCards(
    content,
    input.cards.filter((card) => card.courseId === input.courseId),
  )
  const slots =
    mode.type === 'lesson' ? lessonSlots(input, cards, mode.lessonId, rng) : reviewSlots(cards, now)

  const encountered = encounteredEntities(content, cards)
  if (mode.type === 'lesson')
    for (const id of content.lesson(mode.lessonId)?.lesson.introduces ?? []) encountered.add(id)

  const built = new Map<Slot, BuiltSlot>()
  for (const slot of slots) {
    const exercise = buildExercise({ ...slot.request, id: '' }, { content, rng, encountered })
    if (exercise) built.set(slot, { ...slot, exercise })
  }
  // Point dependencies at the built slots; a work whose introduction failed is simply not presented.
  for (const slot of built.values()) slot.after = slot.after && built.get(slot.after)

  return schedule(keepHalfSensory([...built.values()])).map((slot, index) => ({
    ...slot.exercise,
    id: `${index + 1}-${slot.exercise.cardId}`,
  }))
}

function lessonSlots(
  { content, now }: BuildSessionInput,
  cards: CardRecord[],
  lessonId: string,
  rng: Rng,
): Slot[] {
  const ref = content.lesson(lessonId)
  if (!ref) throw new Error(`Unknown lesson ${lessonId}`)
  const keys = lessonCardKeys(content, ref.lesson)
  const byId = new Map(cards.map((card) => [card.id, card]))

  // A work met for the first time is presented, then asked with its first skill.
  const intros = new Map<string, Slot>()
  const practice: Slot[] = []
  let previousIntro: Slot | undefined
  for (const card of keys) {
    const known = byId.get(card.id)
    if (!known && !intros.has(card.entityId)) {
      const slot: Slot = {
        request: { card, graded: true, intro: true, mastery: 0 },
        target: 0,
        after: previousIntro,
        keep: 3,
      }
      intros.set(card.entityId, slot)
      previousIntro = slot
    } else {
      practice.push({
        request: { card, graded: true, intro: false, mastery: mastery(known?.fsrs) },
        target: 0,
        after: intros.get(card.entityId),
        keep: 2,
      })
    }
  }

  const lessonCount = intros.size + practice.length
  const keyIds = new Set(keys.map((k) => k.id))
  const reviews = varied(
    dueCards(cards, now).filter((card) => !keyIds.has(card.id)),
    clamp(LESSON_LENGTH - lessonCount, LESSON_REVIEWS.min, LESSON_REVIEWS.max),
  )
  const rework = reworkKeys(keys, LESSON_LENGTH - lessonCount - reviews.length)

  // Spread everything out: introductions early, practice after its introduction, reviews evenly,
  // rework towards the end.
  const total = lessonCount + reviews.length + rework.length
  const introSlots = [...intros.values()]
  introSlots.forEach((slot, i) => (slot.target = (i * INTRO_SPAN * total) / introSlots.length))
  for (const slot of practice) {
    const from = slot.after ? slot.after.target + 1 : 0
    slot.target = from + rng() * (total - from)
  }
  const reviewSlots = reviews.map((card, i): Slot => ({
    request: { card, graded: true, intro: false, mastery: mastery(card.fsrs) },
    target: ((i + 0.5) * total) / reviews.length,
    keep: 1,
  }))
  const reworkSlots = rework.map((card): Slot => ({
    request: {
      card,
      graded: false,
      intro: false,
      mastery: Math.max(REWORK_MASTERY, mastery(byId.get(card.id)?.fsrs)),
    },
    target: total * (INTRO_SPAN + rng() * (1 - INTRO_SPAN)),
    after: intros.get(card.entityId),
    keep: 0,
  }))
  return [...introSlots, ...practice, ...reviewSlots, ...reworkSlots]
}

/** The first `count` cards, taking one card per work before a second one. */
function varied(cards: CardRecord[], count: number): CardRecord[] {
  const works = new Set<string>()
  const first = cards.filter((c) => !works.has(c.entityId) && works.add(c.entityId))
  return [...first, ...cards.filter((c) => !first.includes(c))].slice(0, count)
}

/** Extra, ungraded practice on the lesson's cards: sensory skills first, one work after another. */
function reworkKeys(keys: CardKey[], count: number): CardKey[] {
  if (count <= 0) return []
  const byEntity = new Map<string, CardKey[]>()
  const sensoryFirst = [...keys].sort(
    (a, b) => Number(!SKILL_SPECS[a.skill].media) - Number(!SKILL_SPECS[b.skill].media),
  )
  for (const key of sensoryFirst)
    byEntity.set(key.entityId, [...(byEntity.get(key.entityId) ?? []), key])

  const picked: CardKey[] = []
  for (let round = 0; picked.length < count; round++) {
    const layer = [...byEntity.values()].map((list) => list[round]).filter((k) => k !== undefined)
    if (layer.length === 0) break
    picked.push(...layer.slice(0, count - picked.length))
  }
  return picked
}

/** Due cards, most overdue first; when nothing is due, the most fragile cards. */
function reviewSlots(cards: CardRecord[], now: Date): Slot[] {
  let picked = dueCards(cards, now).slice(0, REVIEW_LENGTH)
  if (picked.length === 0)
    picked = [...cards]
      .sort((a, b) => a.fsrs.stability - b.fsrs.stability || a.id.localeCompare(b.id))
      .slice(0, REVIEW_LENGTH)
  return picked.map((card, i) => ({
    request: { card, graded: true, intro: false, mastery: mastery(card.fsrs) },
    target: i,
    keep: REVIEW_LENGTH - i,
  }))
}

/** Works the learner has cards for, plus their composers, periods and movements. */
function encounteredEntities(content: CourseIndex, cards: CardRecord[]): Set<string> {
  const seen = new Set<string>()
  for (const card of cards) {
    seen.add(card.entityId)
    for (const type of ['createdBy', 'inPeriod', 'belongsTo'] as const) {
      const target = content.related(card.entityId, type)
      if (target) seen.add(target.id)
    }
  }
  return seen
}

/** At least half of a session hears or sees something: shed text exercises if needed. */
function keepHalfSensory(slots: BuiltSlot[]): BuiltSlot[] {
  const text = slots.filter((s) => !isSensory(s.exercise))
  const excess = text.length - (slots.length - text.length)
  if (excess <= 0) return slots
  const dropped = new Set(
    text
      .filter((s) => !s.request.intro && !slots.some((other) => other.after === s))
      .sort((a, b) => a.keep - b.keep || b.target - a.target)
      .slice(0, excess),
  )
  return slots.filter((s) => !dropped.has(s))
}

/**
 * Orders the slots: never the same work twice in a row (a slot that cannot avoid it is moved
 * earlier, or dropped as a last resort), introductions before their practice, text exercises
 * spread evenly between sensory ones, and as far as possible a different medium and skill from
 * one exercise to the next.
 */
function schedule(slots: BuiltSlot[]): BuiltSlot[] {
  const order: BuiltSlot[] = []
  const placed = new Set<Slot>()
  let pending = [...slots].sort((a, b) => a.target - b.target)
  // Evenly spaced positions for text exercises; placing them on time avoids a text-only ending.
  const textCount = slots.filter((s) => !isSensory(s.exercise)).length
  const textSlots = Array.from({ length: textCount }, (_, k) =>
    Math.floor(((k + 0.5) * slots.length) / textCount),
  )
  let textPlaced = 0

  while (pending.length > 0) {
    const ready = pending.filter((s) => !s.after || placed.has(s.after))
    if (ready.length === 0) break
    const last = order.at(-1)
    const allowed = ready.filter((s) => s.exercise.entityId !== last?.exercise.entityId)

    if (allowed.length === 0) {
      const slot = ready[0]!
      const at = earlierPosition(order, slot)
      if (at !== undefined) {
        order.splice(at, 0, slot)
        placed.add(slot)
      }
      pending = pending.filter((s) => s !== slot)
      continue
    }

    const position = order.length
    const wantText =
      (!last || isSensory(last.exercise)) &&
      textPlaced < textSlots.filter((at) => at <= position).length
    const wanted = allowed.filter((s) => isSensory(s.exercise) !== wantText)
    const cost = (s: BuiltSlot) =>
      s.target -
      position +
      (last && modalityOf(s.exercise) === modalityOf(last.exercise) ? SAME_MODALITY_COST : 0) +
      (last && s.exercise.skill === last.exercise.skill ? SAME_SKILL_COST : 0)
    const best = (wanted.length > 0 ? wanted : allowed).reduce((a, b) =>
      cost(b) < cost(a) ? b : a,
    )
    if (!isSensory(best.exercise)) textPlaced++
    order.push(best)
    placed.add(best)
    pending = pending.filter((s) => s !== best)
  }
  return order
}

/** Latest position where `slot` sits between two other works and after its introduction. */
function earlierPosition(order: BuiltSlot[], slot: BuiltSlot): number | undefined {
  const entity = slot.exercise.entityId
  const minimum = slot.after ? order.findIndex((s) => s === slot.after) + 1 : 0
  for (let at = order.length - 1; at >= Math.max(minimum, 0); at--) {
    const before = order[at - 1]
    const after = order[at]
    if (before?.exercise.entityId !== entity && after?.exercise.entityId !== entity) return at
  }
  return undefined
}
