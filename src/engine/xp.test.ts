import { describe, expect, it } from 'vitest'
import { sessionXp } from './xp'

describe('sessionXp', () => {
  it('gives 10 XP per correct answer', () => {
    expect(sessionXp({ correctAnswers: 7, mistakes: 3, lessonCompleted: false })).toEqual({
      answers: 70,
      lesson: 0,
      flawless: 0,
      total: 70,
    })
  })

  it('adds 5 XP for a completed lesson', () => {
    expect(sessionXp({ correctAnswers: 10, mistakes: 2, lessonCompleted: true }).total).toBe(105)
  })

  it('adds 5 XP for a session without mistakes', () => {
    expect(sessionXp({ correctAnswers: 12, mistakes: 0, lessonCompleted: true })).toEqual({
      answers: 120,
      lesson: 5,
      flawless: 5,
      total: 130,
    })
    expect(sessionXp({ correctAnswers: 5, mistakes: 0, lessonCompleted: false }).total).toBe(55)
  })

  it('gives no flawless bonus to an empty session', () => {
    expect(sessionXp({ correctAnswers: 0, mistakes: 0, lessonCompleted: false }).total).toBe(0)
  })
})
