// The daily challenge in IndexedDB: drawn on the first visit of the day, then updated guess by
// guess. Finding the work adds XP to the day (not a session).
import type { CourseIndex } from '../content/course-index'
import { localDay } from '../engine/calendar'
import {
  challengeStatus,
  challengeStreak,
  challengeXp,
  guess,
  pickChallenge,
  type ChallengeRecord,
} from '../engine/challenge'
import { addXp } from '../engine/streak'
import { db } from './db'
import { loadSettings } from './settings'

/** Today's challenge, drawn and stored on the first call; undefined before any lesson. */
export function openChallenge(
  courses: readonly CourseIndex[],
  now = new Date(),
): Promise<ChallengeRecord | undefined> {
  const date = localDay(now)
  return db.transaction('rw', [db.challenges, db.cards], async () => {
    const existing = await db.challenges.get(date)
    if (existing) return existing
    const challenge = pickChallenge({
      date,
      courses,
      cards: await db.cards.toArray(),
      past: await db.challenges.toArray(),
    })
    if (!challenge) return undefined
    const record: ChallengeRecord = { ...challenge, guesses: [] }
    await db.challenges.put(record)
    return record
  })
}

/** Records a guess for the challenge of `date`; the XP goes to that day once the work is found. */
export async function submitGuess(date: string, optionId: string): Promise<void> {
  const { dailyGoal } = await loadSettings()
  await db.transaction('rw', [db.challenges, db.daily], async () => {
    const record = await db.challenges.get(date)
    if (!record) return
    const next = guess(record, optionId)
    if (next === record) return
    await db.challenges.put(next)
    if (challengeStatus(next) === 'found')
      await db.daily.put(addXp(await db.daily.get(date), date, challengeXp(next), dailyGoal))
  })
}

export interface ChallengeSummary {
  today: ChallengeRecord | undefined
  /** A lesson has been completed: there are works to hide. */
  unlocked: boolean
  streak: number
}

export async function challengeSummary(today: string): Promise<ChallengeSummary> {
  const [records, cardCount] = await Promise.all([db.challenges.toArray(), db.cards.count()])
  return {
    today: records.find((r) => r.date === today),
    unlocked: cardCount > 0,
    streak: challengeStreak(records, today),
  }
}
