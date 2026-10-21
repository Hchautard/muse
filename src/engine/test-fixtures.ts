// Course fixtures for engine tests: a music course shaped like the real unit 1, and a small
// painting course for the image skills.
import { createCourseIndex, type CourseIndex } from '../content/course-index'
import type { CourseBundle, Entity, MediaAsset, Relation, Skill } from '../schemas/content'
import { cardId, type CardRecord } from './cards'
import { newFsrsCard, scheduleReview, Rating } from './fsrs'

const PERIODS: [id: string, start: number, end: number][] = [
  ['baroque', 1600, 1750],
  ['classique', 1750, 1820],
  ['romantique', 1820, 1900],
  ['xxe', 1890, 1945],
]

const COMPOSERS: [id: string, born: number, died: number, period: string, works: number[]][] = [
  ['bach', 1685, 1750, 'baroque', [1704, 1721, 1730]],
  ['vivaldi', 1678, 1741, 'baroque', [1711, 1716, 1725]],
  ['mozart', 1756, 1791, 'classique', [1787, 1788, 1791]],
  ['beethoven', 1770, 1827, 'classique', [1801, 1808, 1810]],
  ['chopin', 1810, 1849, 'romantique', [1831, 1832, 1842]],
  ['tchaikovski', 1840, 1893, 'romantique', [1875, 1876, 1892]],
  ['debussy', 1862, 1918, 'xxe', [1888, 1894, 1905]],
  ['ravel', 1875, 1937, 'xxe', [1899, 1901, 1928]],
]

const MUSIC_SKILLS: Skill[] = ['audio-to-composer', 'audio-to-period', 'work-to-date']

const entity = (fields: Partial<Entity> & Pick<Entity, 'id' | 'type'>): Entity => ({
  name: fields.id,
  summary: `Résumé de ${fields.id}.`,
  mediaIds: [],
  ...fields,
})

const asset = (id: string, kind: MediaAsset['kind']): MediaAsset => ({
  id,
  kind,
  src: `test/${id}.${kind === 'audio' ? 'm4a' : 'webp'}`,
  bytes: 1000,
  credit: 'Interprète',
  license: 'Public domain',
  sourceUrl: `https://commons.wikimedia.org/wiki/File:${id}`,
})

/** Works are named "<composer>-<n>" (n from 1 to 3). */
export function makeMusicCourse(): CourseIndex {
  const entities: Entity[] = PERIODS.map(([id, yearStart, yearEnd]) =>
    entity({ id, type: 'period', yearStart, yearEnd }),
  )
  const relations: Relation[] = []
  const media: MediaAsset[] = []
  const lessons = []

  for (const [id, yearStart, yearEnd, period, years] of COMPOSERS) {
    entities.push(entity({ id, type: 'person', yearStart, yearEnd }))
    relations.push({ from: id, type: 'inPeriod', to: period })
    const works = years.map((year, i) => {
      const work = `${id}-${i + 1}`
      media.push(asset(`${work}-audio`, 'audio'))
      entities.push(entity({ id: work, type: 'work', year, mediaIds: [`${work}-audio`] }))
      relations.push(
        { from: work, type: 'createdBy', to: id },
        { from: work, type: 'inPeriod', to: period },
      )
      return work
    })
    const firstOfPeriod = COMPOSERS.find((c) => c[3] === period)?.[0] === id
    lessons.push({
      id: `lesson-${id}`,
      title: id,
      introduces: [...(firstOfPeriod ? [period] : []), id, ...works],
      skills: MUSIC_SKILLS,
    })
  }

  const bundle: CourseBundle = {
    id: 'music',
    title: 'Musique',
    version: 'test',
    units: [{ id: 'unit-1', title: 'Repères', description: 'Test', lessons }],
    entities,
    relations,
    media,
  }
  return createCourseIndex(bundle)
}

/** Three painters, two movements, two paintings each. */
export function makeArtCourse(): CourseIndex {
  const painters: [id: string, born: number, died: number, movement: string, works: number[]][] = [
    ['monet', 1840, 1926, 'impressionnisme', [1872, 1899]],
    ['renoir', 1841, 1919, 'impressionnisme', [1876, 1881]],
    ['picasso', 1881, 1973, 'cubisme', [1907, 1937]],
  ]
  const entities: Entity[] = [
    entity({ id: 'impressionnisme', type: 'movement', yearStart: 1860, yearEnd: 1890 }),
    entity({ id: 'cubisme', type: 'movement', yearStart: 1907, yearEnd: 1925 }),
  ]
  const relations: Relation[] = []
  const media: MediaAsset[] = []
  const introduces: string[] = []
  for (const [id, yearStart, yearEnd, movement, years] of painters) {
    entities.push(entity({ id, type: 'person', yearStart, yearEnd }))
    years.forEach((year, i) => {
      const work = `${id}-${i + 1}`
      media.push(asset(`${work}-image`, 'image'))
      entities.push(entity({ id: work, type: 'work', year, mediaIds: [`${work}-image`] }))
      relations.push(
        { from: work, type: 'createdBy', to: id },
        { from: work, type: 'belongsTo', to: movement },
      )
      introduces.push(work)
    })
  }
  const bundle: CourseBundle = {
    id: 'art',
    title: 'Peinture',
    version: 'test',
    units: [
      {
        id: 'art-1',
        title: 'Mouvements',
        description: 'Test',
        lessons: [
          {
            id: 'art-lesson',
            title: 'Tout',
            introduces,
            skills: ['image-to-artist', 'image-to-movement', 'work-to-date'],
          },
        ],
      },
    ],
    entities,
    relations,
    media,
  }
  return createCourseIndex(bundle)
}

/** Five concepts, each summary naming its concept, and one lesson matching them. */
export function makeConceptCourse(): CourseIndex {
  const concepts: [id: string, name: string, summary: string][] = [
    ['fugue', 'Fugue', 'La fugue fait entrer un thème voix après voix. Elle est très savante.'],
    ['sonate', 'Sonate', 'Une sonate est une pièce pour un ou deux instruments.'],
    ['symphonie', 'Symphonie', 'Grande œuvre pour orchestre, la symphonie a plusieurs mouvements.'],
    ['concerto', 'Concerto', 'Le concerto oppose un soliste et l’orchestre.'],
    ['opera', 'Opéra', 'Les opéras sont des drames chantés, mis en scène.'],
  ]
  const bundle: CourseBundle = {
    id: 'music',
    title: 'Formes',
    version: 'test',
    units: [
      {
        id: 'forms',
        title: 'Formes',
        description: 'Test',
        lessons: [
          {
            id: 'forms-lesson',
            title: 'Formes',
            introduces: concepts.map(([id]) => id),
            skills: ['concept-definition'],
          },
        ],
      },
    ],
    entities: concepts.map(([id, name, summary]) => entity({ id, type: 'concept', name, summary })),
    relations: [],
    media: [],
  }
  return createCourseIndex(bundle)
}

export const MUSIC_LESSON_IDS = COMPOSERS.map(([id]) => `lesson-${id}`)

/** A card answered once (Good by default) at `reviewedAt`. */
export function makeCard(
  entityId: string,
  skill: Skill,
  reviewedAt: Date,
  rating: Rating.Again | Rating.Good | Rating.Easy = Rating.Good,
): CardRecord {
  const fsrs = scheduleReview(newFsrsCard(reviewedAt), rating, reviewedAt).card
  return {
    id: cardId(entityId, skill),
    courseId: 'music',
    entityId,
    skill,
    fsrs,
    introducedAt: reviewedAt,
  }
}

/** The cards of the first `count` music lessons, all learned at `reviewedAt`. */
export function learnedMusicCards(count: number, reviewedAt: Date): CardRecord[] {
  return COMPOSERS.slice(0, count).flatMap(([id]) =>
    [1, 2, 3].flatMap((n) =>
      MUSIC_SKILLS.map((skill) => makeCard(`${id}-${n}`, skill, reviewedAt)),
    ),
  )
}
