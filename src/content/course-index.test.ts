import { describe, expect, it } from 'vitest'
import { makeBundle } from '../../scripts/lib/test-fixtures'
import { createCourseIndex, formatDates } from './course-index'

describe('createCourseIndex', () => {
  const course = createCourseIndex(makeBundle())

  it('finds entities, relations and media', () => {
    const toccata = course.entity('toccata')!
    expect(course.related('toccata', 'createdBy')?.name).toBe('Bach')
    expect(course.related('toccata', 'inPeriod')?.id).toBe('baroque')
    expect(course.related('toccata', 'belongsTo')).toBeUndefined()
    expect(course.media(toccata, 'audio')?.id).toBe('toccata-audio')
    expect(course.media(toccata, 'image')).toBeUndefined()
    expect(course.asset('bach-image')?.kind).toBe('image')
    expect(course.asset('nope')).toBeUndefined()
  })

  it('lists lessons in course order with their unit', () => {
    expect(course.lessons.map((ref) => [ref.lesson.id, ref.unit.id, ref.index])).toEqual([
      ['l1', 'u1', 0],
    ])
    expect(course.lesson('l1')?.lesson.title).toBe('Bach')
  })
})

describe('formatDates', () => {
  it('formats works, people and periods', () => {
    const [period, person, work] = makeBundle().entities
    expect(formatDates(work!)).toBe('1704')
    expect(formatDates(person!)).toBe('1685–1750')
    expect(formatDates(period!)).toBe('1600–1750')
    expect(formatDates({ ...work!, year: undefined })).toBeUndefined()
  })
})
