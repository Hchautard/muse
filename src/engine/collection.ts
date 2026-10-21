// The learner's "personal museum": the works they have met, and how well they know each one.
import type { CourseIndex } from '../content/course-index'
import { SKILLS, type Entity } from '../schemas/content'
import type { CardRecord } from './cards'
import { mastery } from './fsrs'

export interface CollectedWork {
  work: Entity
  creator?: Entity
  /** Period, or movement for paintings without a period: what the collection is filtered by. */
  group?: Entity
  /** The work's cards, in skill order. */
  cards: CardRecord[]
  /** Mean mastery of the cards, from 0 to 1. */
  mastery: number
  firstMetAt: Date
}

/** Works that have at least one card, oldest first (then by name). */
export function collectedWorks(
  content: CourseIndex,
  cards: readonly CardRecord[],
): CollectedWork[] {
  const byWork = new Map<string, CardRecord[]>()
  for (const card of cards) byWork.set(card.entityId, [...(byWork.get(card.entityId) ?? []), card])

  const works: CollectedWork[] = []
  for (const [id, workCards] of byWork) {
    const work = content.entity(id)
    if (work?.type !== 'work') continue
    workCards.sort((a, b) => SKILLS.indexOf(a.skill) - SKILLS.indexOf(b.skill))
    works.push({
      work,
      creator: content.related(id, 'createdBy'),
      group: content.related(id, 'inPeriod') ?? content.related(id, 'belongsTo'),
      cards: workCards,
      mastery: workCards.reduce((sum, c) => sum + mastery(c.fsrs), 0) / workCards.length,
      firstMetAt: new Date(Math.min(...workCards.map((c) => c.introducedAt.getTime()))),
    })
  }
  return works.sort(
    (a, b) =>
      (a.work.year ?? Infinity) - (b.work.year ?? Infinity) ||
      a.work.name.localeCompare(b.work.name, 'fr'),
  )
}

/** The periods (or movements) of the collected works, in chronological order. */
export function collectionGroups(works: readonly CollectedWork[]): Entity[] {
  const groups = new Map<string, Entity>()
  for (const { group } of works) if (group) groups.set(group.id, group)
  return [...groups.values()].sort(
    (a, b) => (a.yearStart ?? Infinity) - (b.yearStart ?? Infinity) || a.id.localeCompare(b.id),
  )
}

export type MasteryStep = 1 | 2 | 3 | 4

/** Mastery on a four-step scale: discovered, in progress, solid, mastered. */
export function masteryStep(value: number): MasteryStep {
  if (value >= 1) return 4
  if (value >= 0.6) return 3
  if (value >= 0.25) return 2
  return 1
}
