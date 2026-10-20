import { describe, expect, it } from 'vitest'
import { lessonStates } from './progression'

const lessons = ['l1', 'l2', 'l3', 'l4']

describe('lessonStates', () => {
  it('opens only the first lesson at the start', () => {
    const states = lessonStates(lessons, new Set())
    expect([...states.values()]).toEqual(['current', 'locked', 'locked', 'locked'])
  })

  it('makes the first unfinished lesson current', () => {
    const states = lessonStates(lessons, new Set(['l1', 'l2']))
    expect([...states.values()]).toEqual(['completed', 'completed', 'current', 'locked'])
  })

  it('has no current lesson once everything is completed', () => {
    const states = lessonStates(lessons, new Set(lessons))
    expect([...states.values()]).toEqual(['completed', 'completed', 'completed', 'completed'])
  })

  it('keeps out-of-order completions completed', () => {
    const states = lessonStates(lessons, new Set(['l1', 'l3']))
    expect(states.get('l2')).toBe('current')
    expect(states.get('l3')).toBe('completed')
    expect(states.get('l4')).toBe('locked')
  })
})
