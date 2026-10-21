// Experience points earned in a session.

export const XP_RULES = {
  perCorrectAnswer: 10,
  lessonCompleted: 5,
  flawless: 5,
} as const

export interface XpInput {
  /** Correct first attempts (retries earn nothing). */
  correctAnswers: number
  mistakes: number
  lessonCompleted: boolean
}

export interface XpBreakdown {
  answers: number
  lesson: number
  flawless: number
  total: number
}

export function sessionXp({ correctAnswers, mistakes, lessonCompleted }: XpInput): XpBreakdown {
  const answers = correctAnswers * XP_RULES.perCorrectAnswer
  const lesson = lessonCompleted ? XP_RULES.lessonCompleted : 0
  const flawless = mistakes === 0 && correctAnswers > 0 ? XP_RULES.flawless : 0
  return { answers, lesson, flawless, total: answers + lesson + flawless }
}
