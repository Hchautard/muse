// Lookup helpers over a course bundle. Pure functions, no React.
import type {
  CourseBundle,
  Entity,
  Lesson,
  MediaAsset,
  RelationType,
  Unit,
} from '../schemas/content'

export interface LessonRef {
  lesson: Lesson
  unit: Unit
  /** Position in the whole course, starting at 0. */
  index: number
}

export interface CourseIndex {
  bundle: CourseBundle
  entity(id: string): Entity | undefined
  /** First entity reached from `fromId` through a relation of the given type. */
  related(fromId: string, type: RelationType): Entity | undefined
  media(entity: Entity, kind: MediaAsset['kind']): MediaAsset | undefined
  /** All lessons in course order. */
  lessons: LessonRef[]
  lesson(id: string): LessonRef | undefined
}

export function createCourseIndex(bundle: CourseBundle): CourseIndex {
  const entities = new Map(bundle.entities.map((e) => [e.id, e]))
  const media = new Map(bundle.media.map((m) => [m.id, m]))
  const relations = new Map<string, string[]>()
  for (const r of bundle.relations) {
    const key = `${r.from}|${r.type}`
    relations.set(key, [...(relations.get(key) ?? []), r.to])
  }

  const lessons: LessonRef[] = bundle.units.flatMap((unit) =>
    unit.lessons.map((lesson) => ({ lesson, unit, index: 0 })),
  )
  lessons.forEach((ref, index) => (ref.index = index))
  const lessonsById = new Map(lessons.map((ref) => [ref.lesson.id, ref]))

  return {
    bundle,
    entity: (id) => entities.get(id),
    related(fromId, type) {
      const target = relations.get(`${fromId}|${type}`)?.[0]
      return target ? entities.get(target) : undefined
    },
    media(entity, kind) {
      for (const id of entity.mediaIds) {
        const asset = media.get(id)
        if (asset?.kind === kind) return asset
      }
      return undefined
    },
    lessons,
    lesson: (id) => lessonsById.get(id),
  }
}

/** "1725" for a work, "1685–1750" for a person or period, undefined without dates. */
export function formatDates(entity: Entity): string | undefined {
  if (entity.year !== undefined) return String(entity.year)
  if (entity.yearStart !== undefined && entity.yearEnd !== undefined)
    return `${entity.yearStart}–${entity.yearEnd}`
  if (entity.yearStart !== undefined) return `né en ${entity.yearStart}`
  return undefined
}
