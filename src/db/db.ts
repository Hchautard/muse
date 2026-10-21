// The learner's progress, stored locally in IndexedDB.
import { Dexie, type EntityTable } from 'dexie'
import type { CardRecord } from '../engine/cards'
import type { ReviewEntry } from '../engine/review'
import type { DayStats } from '../engine/streak'
import type { CourseId } from '../schemas/content'

export interface ReviewLogRecord extends ReviewEntry {
  id?: number
  courseId: CourseId
}

export interface LessonRecord {
  lessonId: string
  courseId: CourseId
  /** First completion. */
  completedAt: Date
  /** Best share of right first answers, from 0 to 1. */
  bestScore: number
}

export interface SettingRecord {
  key: string
  value: unknown
}

export type MuseDb = Dexie & {
  cards: EntityTable<CardRecord, 'id'>
  reviewLog: EntityTable<ReviewLogRecord, 'id'>
  lessons: EntityTable<LessonRecord, 'lessonId'>
  daily: EntityTable<DayStats, 'date'>
  settings: EntityTable<SettingRecord, 'key'>
}

export const db = new Dexie('muse') as MuseDb

db.version(1).stores({
  cards: 'id, courseId',
  reviewLog: '++id, cardId, courseId, answeredAt',
  lessons: 'lessonId, courseId',
  daily: 'date',
  settings: 'key',
})

/** Asks the browser not to evict progress under storage pressure (no prompt on most browsers). */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (!navigator.storage?.persist || (await navigator.storage.persisted())) return
    await navigator.storage.persist()
  } catch (error) {
    console.warn('Persistent storage request failed', error)
  }
}
