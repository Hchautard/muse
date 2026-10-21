// Wrong answers for a question. The better the learner knows a card, the closer the distractors.
import type { CourseIndex } from '../content/course-index'
import type { Entity, Skill } from '../schemas/content'
import type { Rng } from './random'
import { SKILL_SPECS } from './skills'

export interface DistractorOptions {
  rng: Rng
  /** Entities the learner has already met: preferred over unknown ones. */
  encountered?: ReadonlySet<string>
  /** Defaults to 3, for a four-choice question. */
  count?: number
}

/** Two entities this many years apart (or more) are not close at all in time. */
const DATE_SCALE_YEARS = 150
const ENCOUNTERED_BONUS = 0.25
const JITTER = 0.2

function midYear(entity: Entity): number | undefined {
  if (entity.year !== undefined) return entity.year
  if (entity.yearStart === undefined) return undefined
  return (entity.yearStart + (entity.yearEnd ?? entity.yearStart)) / 2
}

/**
 * How easily `candidate` can be mistaken for `answer`, from 0 (nothing in common) to 1: nearby
 * dates, same period, same movement and, for works, same creator.
 */
export function closeness(answer: Entity, candidate: Entity, content: CourseIndex): number {
  const signals: [weight: number, value: number][] = []
  const a = midYear(answer)
  const c = midYear(candidate)
  if (a !== undefined && c !== undefined)
    signals.push([0.5, Math.max(0, 1 - Math.abs(a - c) / DATE_SCALE_YEARS)])

  const shared = [
    ['inPeriod', 0.3],
    ['belongsTo', 0.2],
    ['createdBy', 0.2],
  ] as const
  for (const [type, weight] of shared) {
    const x = content.related(answer.id, type)?.id
    const y = content.related(candidate.id, type)?.id
    if (x && y) signals.push([weight, x === y ? 1 : 0])
  }

  const total = signals.reduce((sum, [weight]) => sum + weight, 0)
  return total === 0 ? 0 : signals.reduce((sum, [weight, value]) => sum + weight * value, 0) / total
}

/** Entities that could stand in for the answer: same type and same role (composers, periods…). */
function candidatePool(answer: Entity, skill: Skill, content: CourseIndex): Entity[] {
  const relation = SKILL_SPECS[skill].answer
  const roleHolders = relation
    ? new Set(content.bundle.relations.filter((r) => r.type === relation).map((r) => r.to))
    : undefined
  return content.bundle.entities
    .filter(
      (e) =>
        e.id !== answer.id &&
        e.type === answer.type &&
        (!roleHolders || roleHolders.has(e.id)) &&
        (skill !== 'work-to-date' || e.year !== undefined),
    )
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Picks up to `count` distractors for `answer`. `mastery` (0 to 1) sets the difficulty: a new
 * card gets distractors from other eras, a well-known one gets neighbours. Deterministic for a
 * given random source. For dates, every pick has a different year so that ordering is fair.
 */
export function pickDistractors(
  answer: Entity,
  skill: Skill,
  content: CourseIndex,
  mastery: number,
  { rng, encountered = new Set(), count = 3 }: DistractorOptions,
): Entity[] {
  const scored = candidatePool(answer, skill, content).map((entity) => ({
    entity,
    score:
      -Math.abs(closeness(answer, entity, content) - mastery) +
      (encountered.has(entity.id) ? ENCOUNTERED_BONUS : 0) +
      rng() * JITTER,
  }))
  scored.sort((a, b) => b.score - a.score)

  const picked: Entity[] = []
  const years = new Set([answer.year])
  for (const { entity } of scored) {
    if (picked.length === count) break
    if (skill === 'work-to-date') {
      if (years.has(entity.year)) continue
      years.add(entity.year)
    }
    picked.push(entity)
  }
  return picked
}
