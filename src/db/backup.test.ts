import { describe, expect, it } from 'vitest'
import { Rating } from '../engine/fsrs'
import { learnedMusicCards, makeCard } from '../engine/test-fixtures'
import { BackupError, parseBackup, serializeBackup, type ProgressData } from './backup'

const at = new Date(2026, 9, 21, 9, 30, 12, 345)

function sampleProgress(): ProgressData {
  const cards = [
    ...learnedMusicCards(2, at),
    makeCard('mozart-1', 'audio-to-composer', at, Rating.Again),
  ]
  return {
    cards,
    reviewLog: [
      {
        id: 1,
        courseId: 'music',
        cardId: cards[0]!.id,
        rating: Rating.Good,
        answeredAt: at,
        durationMs: 4210.5,
        correct: true,
        kind: 'audio-choice',
        expectedId: 'bach',
        chosenId: 'bach',
      },
      {
        id: 2,
        courseId: 'music',
        cardId: cards[1]!.id,
        rating: Rating.Again,
        answeredAt: new Date(at.getTime() + 61_000),
        durationMs: 30_000,
        correct: false,
        kind: 'association',
        mismatches: [{ expectedId: 'bach', chosenId: 'vivaldi' }],
      },
    ],
    lessons: [{ lessonId: 'music-1-1', courseId: 'music', completedAt: at, bestScore: 0.75 }],
    daily: [{ date: '2026-10-21', xp: 125, minutes: 4.4, sessions: 2, goal: 2 }],
    settings: [
      { key: 'dailyGoal', value: 2 },
      { key: 'sound', value: false },
    ],
    challenges: [
      {
        date: '2026-10-21',
        courseId: 'music',
        workId: 'bach-1',
        optionIds: ['vivaldi-2', 'bach-1', 'mozart-1'],
        focus: { x: 0.31, y: 0.62 },
        guesses: ['vivaldi-2', 'bach-1'],
      },
    ],
  }
}

describe('progress backup', () => {
  it('restores exactly what was exported', () => {
    const data = sampleProgress()
    const restored = parseBackup(serializeBackup(data, at))
    expect(restored).toStrictEqual({ ...data, exportedAt: at })
    expect(restored.cards[0]?.fsrs.due).toBeInstanceOf(Date)
  })

  it('refuses files that are not a Muse backup', () => {
    expect(() => parseBackup('pas du JSON')).toThrow(BackupError)
    expect(() => parseBackup('{"cards": []}')).toThrow('pas une sauvegarde Muse')
  })

  it('refuses a backup from a newer version', () => {
    const newer = JSON.parse(serializeBackup(sampleProgress(), at)) as Record<string, unknown>
    newer.version = 3
    expect(() => parseBackup(JSON.stringify(newer))).toThrow('version plus récente')
  })

  it('reads a backup from before the daily challenge', () => {
    const v1 = JSON.parse(serializeBackup(sampleProgress(), at)) as Record<string, unknown>
    v1.version = 1
    delete v1.challenges
    expect(parseBackup(JSON.stringify(v1)).challenges).toEqual([])
  })

  it('refuses a damaged backup', () => {
    const damaged = JSON.parse(serializeBackup(sampleProgress(), at)) as {
      cards: { fsrs: { due: string } }[]
    }
    damaged.cards[0]!.fsrs.due = 'hier'
    expect(() => parseBackup(JSON.stringify(damaged))).toThrow('incomplète ou abîmée')
  })
})
