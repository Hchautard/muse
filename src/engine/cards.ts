// Review cards: one per entity × skill, e.g. "recognise Clair de lune by ear".
import type { CourseIndex } from '../content/course-index'
import type { CourseId, Lesson, Skill } from '../schemas/content'
import { startOfNextDay } from './calendar'
import type { Card } from './fsrs'
import { skillApplies } from './skills'

export interface CardKey {
  id: string
  entityId: string
  skill: Skill
}

/** What the learner's database stores for each card. */
export interface CardRecord extends CardKey {
  courseId: CourseId
  fsrs: Card
  introducedAt: Date
}

export const cardId = (entityId: string, skill: Skill) => `${entityId}:${skill}`

/** Cards a lesson introduces: its new works × its skills, when the content allows the skill. */
export function lessonCardKeys(content: CourseIndex, lesson: Lesson): CardKey[] {
  const keys: CardKey[] = []
  for (const entityId of lesson.introduces) {
    const entity = content.entity(entityId)
    if (!entity) continue
    for (const skill of lesson.skills) {
      if (skillApplies(content, entity, skill))
        keys.push({ id: cardId(entityId, skill), entityId, skill })
    }
  }
  return keys
}

/** Cards still backed by the content (an entity or a medium may have been removed since). */
export function playableCards(content: CourseIndex, cards: readonly CardRecord[]): CardRecord[] {
  return cards.filter((card) => {
    const entity = content.entity(card.entityId)
    return entity !== undefined && skillApplies(content, entity, card.skill)
  })
}

/** A card is due for the whole local day on which it falls due. */
export function isDue(card: CardRecord, now: Date): boolean {
  return card.fsrs.due < startOfNextDay(now)
}

/** Due cards, the most overdue first. */
export function dueCards(cards: readonly CardRecord[], now: Date): CardRecord[] {
  return cards
    .filter((card) => isDue(card, now))
    .sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime() || a.id.localeCompare(b.id))
}
