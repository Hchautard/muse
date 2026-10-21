// What each skill needs from an entity, and what the expected answer is.
import type { CourseIndex } from '../content/course-index'
import type { Entity, RelationType, Skill } from '../schemas/content'

export interface SkillSpec {
  /** Type of entity the card is about. */
  subject: 'work' | 'concept'
  /** Media the learner hears or sees. */
  media?: 'audio' | 'image'
  /** Relation from the entity whose target is the expected answer (otherwise the entity itself). */
  answer?: RelationType
  /** The work needs a year. */
  year?: true
}

export const SKILL_SPECS: Record<Skill, SkillSpec> = {
  'audio-to-composer': { subject: 'work', media: 'audio', answer: 'createdBy' },
  'audio-to-period': { subject: 'work', media: 'audio', answer: 'inPeriod' },
  'image-to-artist': { subject: 'work', media: 'image', answer: 'createdBy' },
  'image-to-movement': { subject: 'work', media: 'image', answer: 'belongsTo' },
  'work-to-date': { subject: 'work', year: true },
  // The concept's summary is its definition.
  'concept-definition': { subject: 'concept' },
}

/** Whether a card "entity × skill" can be practised with the content at hand. */
export function skillApplies(content: CourseIndex, entity: Entity, skill: Skill): boolean {
  const spec = SKILL_SPECS[skill]
  if (entity.type !== spec.subject) return false
  if (spec.media && !content.media(entity, spec.media)) return false
  if (spec.answer && !content.related(entity.id, spec.answer)) return false
  if (spec.year && entity.year === undefined) return false
  return true
}

/** The entity the learner must pick: the composer, the period… or the entity itself. */
export function skillAnswer(
  content: CourseIndex,
  entity: Entity,
  skill: Skill,
): Entity | undefined {
  const spec = SKILL_SPECS[skill]
  return spec.answer ? content.related(entity.id, spec.answer) : entity
}
