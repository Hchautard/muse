// Figures for the statistics screen, from the days, the cards and the review log.
import { addDays, daysBetween } from './calendar'
import type { CardRecord } from './cards'
import type { Mismatch } from './exercises'
import { MASTERED_STABILITY_DAYS } from './fsrs'
import { isGoalMet, type DayStats } from './streak'

export interface DayXp {
  date: string
  xp: number
  goalMet: boolean
}

/** XP of the last `count` days, oldest first and today last; days without a session count 0. */
export function xpHistory(days: readonly DayStats[], today: string, count = 30): DayXp[] {
  const byDate = new Map(days.map((day) => [day.date, day]))
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(today, i - count + 1)
    const day = byDate.get(date)
    return { date, xp: day?.xp ?? 0, goalMet: isGoalMet(day) }
  })
}

/** The longest run of consecutive days with the goal reached. */
export function longestStreak(days: readonly DayStats[]): number {
  const met = days
    .filter(isGoalMet)
    .map((day) => day.date)
    .sort()
  let best = 0
  let run = 0
  let previous: string | undefined
  for (const date of met) {
    run = previous !== undefined && daysBetween(previous, date) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    previous = date
  }
  return best
}

export type CardLevel = 'learning' | 'consolidating' | 'mastered'
export const CARD_LEVELS: CardLevel[] = ['learning', 'consolidating', 'mastered']

/** From this stability (in days) on, a card is consolidated; mastered from three weeks. */
export const CONSOLIDATED_STABILITY_DAYS = 7

export function cardLevel(card: CardRecord): CardLevel {
  const { stability } = card.fsrs
  if (stability >= MASTERED_STABILITY_DAYS) return 'mastered'
  if (stability >= CONSOLIDATED_STABILITY_DAYS) return 'consolidating'
  return 'learning'
}

export function countByLevel(cards: readonly CardRecord[]): Record<CardLevel, number> {
  const counts: Record<CardLevel, number> = { learning: 0, consolidating: 0, mastered: 0 }
  for (const card of cards) counts[cardLevel(card)]++
  return counts
}

/** What the review log says about a wrong answer. */
export interface ConfusionSource {
  answeredAt: Date
  correct: boolean
  expectedId?: string
  chosenId?: string
  mismatches?: Mismatch[]
}

export interface Confusion {
  /** The two entities, in alphabetical order. */
  ids: [string, string]
  count: number
  lastAt: Date
}

/**
 * Pairs of entities most often mistaken for one another, either way round: the most frequent
 * first, then the most recent. Only answers from `since` on count, so that old mistakes fade.
 */
export function weakPoints(
  logs: readonly ConfusionSource[],
  { since, limit = 5 }: { since?: Date; limit?: number } = {},
): Confusion[] {
  const confusions = new Map<string, Confusion>()
  for (const log of logs) {
    if (since && log.answeredAt < since) continue
    const picks = [...(log.mismatches ?? [])]
    if (!log.correct && log.expectedId && log.chosenId)
      picks.push({ expectedId: log.expectedId, chosenId: log.chosenId })

    for (const { expectedId, chosenId } of picks) {
      if (expectedId === chosenId) continue
      const ids = [expectedId, chosenId].sort() as [string, string]
      const key = ids.join('|')
      const previous = confusions.get(key)
      confusions.set(key, {
        ids,
        count: (previous?.count ?? 0) + 1,
        lastAt: previous && previous.lastAt > log.answeredAt ? previous.lastAt : log.answeredAt,
      })
    }
  }
  return [...confusions.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.lastAt.getTime() - a.lastAt.getTime() ||
        a.ids.join('|').localeCompare(b.ids.join('|')),
    )
    .slice(0, limit)
}
