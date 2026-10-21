// The daily challenge: one mystery work a day, among the works already met, guessed among a few
// titles while clues are revealed one after the other.
import type { CourseIndex } from '../content/course-index'
import type { CourseId } from '../schemas/content'
import { addDays } from './calendar'
import type { CardRecord } from './cards'
import { pickDistractors } from './distractors'
import { createRng, hashSeed, shuffle } from './random'

/** Guesses allowed; each wrong one reveals the next clue. */
export const CHALLENGE_GUESSES = 4
/** Titles to choose from, the mystery included. */
export const CHALLENGE_OPTIONS = 6
/** XP for a work found at the first, second… guess. */
export const CHALLENGE_XP = [20, 15, 10, 5]
/** A work that was the mystery in this many past days is not picked again, if possible. */
const RECENT_DAYS = 30
/** Rather close titles (same period, nearby dates), so that the clues help. */
const OPTION_CLOSENESS = 0.6
/** Close-ups of paintings are centred in the middle part of the image. */
const FOCUS_MARGIN = 0.25

export interface Challenge {
  /** Local day, "YYYY-MM-DD". */
  date: string
  courseId: CourseId
  workId: string
  /** Titles in display order, the mystery included. */
  optionIds: string[]
  /** Centre of the close-ups of a painting, as fractions of its width and height. */
  focus: { x: number; y: number }
}

export interface ChallengeRecord extends Challenge {
  /** Titles picked, in order. */
  guesses: string[]
}

export type ChallengeStatus = 'playing' | 'found' | 'missed'

export interface ChallengeInput {
  date: string
  courses: readonly CourseIndex[]
  /** The learner's cards, of every course: the mystery is a work met in a lesson. */
  cards: readonly CardRecord[]
  /** Past challenges. */
  past: readonly Challenge[]
}

/** The day's mystery, or undefined until a first lesson has been completed. Deterministic. */
export function pickChallenge({
  date,
  courses,
  cards,
  past,
}: ChallengeInput): Challenge | undefined {
  const rng = createRng(hashSeed(`challenge:${date}`))
  const met = new Set(cards.map((card) => `${card.courseId}:${card.entityId}`))
  const candidates = courses
    .flatMap((content) =>
      content.bundle.entities
        .filter(
          (e) =>
            e.type === 'work' &&
            e.year !== undefined &&
            met.has(`${content.bundle.id}:${e.id}`) &&
            (content.media(e, 'audio') ?? content.media(e, 'image')) !== undefined,
        )
        .map((work) => ({ content, work, key: `${content.bundle.id}:${work.id}` })),
    )
    .sort((a, b) => a.key.localeCompare(b.key))
  if (candidates.length === 0) return undefined

  const since = addDays(date, -RECENT_DAYS)
  const recent = new Set(
    past.filter((c) => c.date >= since && c.date < date).map((c) => `${c.courseId}:${c.workId}`),
  )
  const fresh = candidates.filter((c) => !recent.has(c.key))
  const pool = fresh.length > 0 ? fresh : candidates
  const { content, work } = pool[Math.floor(rng() * pool.length)]!

  const courseId = content.bundle.id
  const encountered = new Set(cards.filter((c) => c.courseId === courseId).map((c) => c.entityId))
  const others = pickDistractors(work, 'work-to-date', content, OPTION_CLOSENESS, {
    rng,
    encountered,
    count: CHALLENGE_OPTIONS - 1,
  })
  const span = 1 - 2 * FOCUS_MARGIN
  return {
    date,
    courseId,
    workId: work.id,
    optionIds: shuffle([work, ...others], rng).map((e) => e.id),
    focus: { x: FOCUS_MARGIN + rng() * span, y: FOCUS_MARGIN + rng() * span },
  }
}

export function challengeStatus(record: ChallengeRecord): ChallengeStatus {
  if (record.guesses.includes(record.workId)) return 'found'
  return record.guesses.length >= CHALLENGE_GUESSES ? 'missed' : 'playing'
}

/** Records a guess; ignored once the challenge is over or for a title already tried. */
export function guess(record: ChallengeRecord, optionId: string): ChallengeRecord {
  if (challengeStatus(record) !== 'playing' || record.guesses.includes(optionId)) return record
  return { ...record, guesses: [...record.guesses, optionId] }
}

/** Clues revealed after the media: one per wrong guess, all of them once the challenge is over. */
export function revealedClues(record: ChallengeRecord): number {
  if (challengeStatus(record) !== 'playing') return CHALLENGE_GUESSES - 1
  return record.guesses.length
}

export function challengeXp(record: ChallengeRecord): number {
  return challengeStatus(record) === 'found' ? (CHALLENGE_XP[record.guesses.length - 1] ?? 0) : 0
}

/** Consecutive days with the mystery found, up to today (or yesterday while today is open). */
export function challengeStreak(records: readonly ChallengeRecord[], today: string): number {
  const found = new Set(records.filter((r) => challengeStatus(r) === 'found').map((r) => r.date))
  let day = found.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (found.has(day)) {
    streak++
    day = addDays(day, -1)
  }
  return streak
}

/** A spoiler-free result to share: one square per guess. */
export function shareText(record: ChallengeRecord, dayLabel: string): string {
  const squares = Array.from({ length: CHALLENGE_GUESSES }, (_, i) => {
    const pick = record.guesses[i]
    if (pick === undefined) return '⬜'
    return pick === record.workId ? '🟩' : '🟥'
  }).join('')
  const status = challengeStatus(record)
  const verdict =
    status === 'found'
      ? `trouvée en ${record.guesses.length} essai${record.guesses.length > 1 ? 's' : ''}`
      : 'pas trouvée'
  return `Muse · œuvre mystère du ${dayLabel} : ${verdict}\n${squares}`
}
