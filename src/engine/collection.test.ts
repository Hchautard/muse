import { describe, expect, it } from 'vitest'
import { collectedWorks, collectionGroups, masteryStep } from './collection'
import { Rating } from './fsrs'
import { learnedMusicCards, makeCard, makeMusicCourse } from './test-fixtures'

const music = makeMusicCourse()
const learnedAt = new Date(2026, 9, 1, 9)

describe('collection', () => {
  it('holds the works met, oldest first, with their creator and period', () => {
    const works = collectedWorks(music, learnedMusicCards(3, learnedAt))
    expect(works.map((w) => w.work.id)).toEqual([
      'bach-1',
      'vivaldi-1',
      'vivaldi-2',
      'bach-2',
      'vivaldi-3',
      'bach-3',
      'mozart-1',
      'mozart-2',
      'mozart-3',
    ])
    const first = works[0]!
    expect(first.creator?.id).toBe('bach')
    expect(first.group?.id).toBe('baroque')
    expect(first.cards.map((c) => c.skill)).toEqual([
      'audio-to-composer',
      'audio-to-period',
      'work-to-date',
    ])
    expect(first.firstMetAt).toEqual(learnedAt)
  })

  it('leaves out cards that are not about a work', () => {
    expect(collectedWorks(music, [makeCard('bach', 'audio-to-composer', learnedAt)])).toEqual([])
  })

  it('averages the mastery of a work’s cards', () => {
    const cards = [
      makeCard('bach-1', 'audio-to-composer', learnedAt, Rating.Easy),
      makeCard('bach-1', 'work-to-date', learnedAt, Rating.Again),
    ]
    const [work] = collectedWorks(music, cards)
    expect(work?.mastery).toBeGreaterThan(0)
    expect(work?.mastery).toBeLessThan(0.5)
  })

  it('offers the periods of the works met, in chronological order', () => {
    const works = collectedWorks(music, learnedMusicCards(8, learnedAt).reverse())
    expect(collectionGroups(works).map((g) => g.id)).toEqual([
      'baroque',
      'classique',
      'romantique',
      'xxe',
    ])
  })

  it('shows mastery on four steps', () => {
    expect([0, 0.2, 0.25, 0.59, 0.6, 0.99, 1].map(masteryStep)).toEqual([1, 1, 2, 2, 3, 3, 4])
  })
})
