// What each skill needs from a work, and what the expected answer is.
import type { CourseIndex } from '../content/course-index'
import type { Entity, RelationType, Skill } from '../schemas/content'

export interface SkillSpec {
  /** Media the learner hears or sees. */
  media?: 'audio' | 'image'
  /** Relation from the work whose target is the expected answer (otherwise the work itself). */
  answer?: RelationType
  /** The work needs a year. */
  year?: true
}

/**
 * Skills the engine can turn into exercises. `concept-definition` arrives with the matching
 * exercise in phase 4; until then it creates no card.
 */
export const SKILL_SPECS: Partial<Record<Skill, SkillSpec>> = {
  'audio-to-composer': { media: 'audio', answer: 'createdBy' },
  'audio-to-period': { media: 'audio', answer: 'inPeriod' },
  'image-to-artist': { media: 'image', answer: 'createdBy' },
  'image-to-movement': { media: 'image', answer: 'belongsTo' },
  'work-to-date': { year: true },
}

/** Whether a card "entity × skill" can be practised with the content at hand. */
export function skillApplies(content: CourseIndex, entity: Entity, skill: Skill): boolean {
  const spec = SKILL_SPECS[skill]
  if (!spec || entity.type !== 'work') return false
  if (spec.media && !content.media(entity, spec.media)) return false
  if (spec.answer && !content.related(entity.id, spec.answer)) return false
  if (spec.year && entity.year === undefined) return false
  return true
}

/** The entity the learner must pick: the composer, the period… or the work itself for dates. */
export function skillAnswer(
  content: CourseIndex,
  entity: Entity,
  skill: Skill,
): Entity | undefined {
  const spec = SKILL_SPECS[skill]
  if (!spec) return undefined
  return spec.answer ? content.related(entity.id, spec.answer) : entity
}
