import { describe, expect, it } from 'vitest'
import type { CourseIndex } from '../content/course-index'
import type { Skill } from '../schemas/content'
import { cardId } from './cards'
import {
  buildExercise,
  exerciseMediaIds,
  isSensory,
  type AssociationExercise,
  type Exercise,
  type ExerciseKind,
} from './exercises'
import { createRng } from './random'
import { makeArtCourse, makeConceptCourse, makeMusicCourse } from './test-fixtures'
import { definitionOf, maskName } from './text'

const music = makeMusicCourse()
const art = makeArtCourse()
const concepts = makeConceptCourse()

function build(
  content: CourseIndex,
  entityId: string,
  skill: Skill,
  mastery: number,
  seed: number,
  intro = false,
): Exercise | undefined {
  return buildExercise(
    {
      id: 'x',
      card: { id: cardId(entityId, skill), entityId, skill },
      graded: true,
      intro,
      mastery,
    },
    {
      content,
      rng: createRng(seed),
      encountered: new Set(content.bundle.entities.map((e) => e.id)),
    },
  )
}

const SEEDS = Array.from({ length: 200 }, (_, seed) => seed)
const kindsOver = (make: (seed: number) => Exercise | undefined) =>
  new Set(SEEDS.map((seed) => make(seed)?.kind))

describe('exercise kinds', () => {
  it('always asks a new card with its main kind', () => {
    expect(kindsOver((seed) => build(music, 'bach-1', 'audio-to-composer', 0, seed, true))).toEqual(
      new Set<ExerciseKind>(['audio-choice']),
    )
    expect(kindsOver((seed) => build(art, 'monet-1', 'image-to-artist', 0.9, seed, true))).toEqual(
      new Set<ExerciseKind>(['image-choice']),
    )
  })

  it('brings in true/false, then associations, as a card gets known', () => {
    expect(kindsOver((seed) => build(music, 'bach-1', 'audio-to-composer', 0.4, seed))).toEqual(
      new Set<ExerciseKind>(['audio-choice', 'true-false']),
    )
    expect(kindsOver((seed) => build(music, 'bach-1', 'audio-to-composer', 0.8, seed))).toEqual(
      new Set<ExerciseKind>(['audio-choice', 'true-false', 'association']),
    )
  })

  it('shows close-ups of well-known paintings only', () => {
    expect(kindsOver((seed) => build(art, 'monet-1', 'image-to-artist', 0.4, seed))).not.toContain(
      'detail',
    )
    expect(kindsOver((seed) => build(art, 'monet-1', 'image-to-artist', 0.8, seed))).toContain(
      'detail',
    )
  })

  it('falls back to the main kind when there are not four pairs to match', () => {
    // Three painters only: no association, its share goes to the four-choice question.
    const kinds = kindsOver((seed) => build(art, 'monet-1', 'image-to-artist', 0.8, seed))
    expect(kinds).not.toContain('association')
    expect(kinds).toContain('image-choice')
  })
})

describe('association', () => {
  const associations = (skill: Skill) =>
    SEEDS.map((seed) => build(music, 'mozart-2', skill, 0.8, seed)).filter(
      (e): e is AssociationExercise => e?.kind === 'association',
    )

  it('matches the work and three others with four different composers', () => {
    const found = associations('audio-to-composer')
    expect(found.length).toBeGreaterThan(10)
    for (const exercise of found) {
      expect(exercise.pairs['mozart-2']).toBe('mozart')
      expect(Object.keys(exercise.pairs)).toHaveLength(4)
      expect(new Set(Object.values(exercise.pairs)).size).toBe(4)
      for (const [work, composer] of Object.entries(exercise.pairs))
        expect(music.related(work, 'createdBy')?.id).toBe(composer)
      expect([...exercise.leftIds].sort()).toEqual(Object.keys(exercise.pairs).sort())
      expect([...exercise.rightIds].sort()).toEqual(Object.values(exercise.pairs).sort())
      // Never lined up pair by pair.
      expect(exercise.leftIds.every((id, i) => exercise.pairs[id] === exercise.rightIds[i])).toBe(
        false,
      )
      expect(isSensory(exercise)).toBe(true)
      expect(exerciseMediaIds(exercise, music)).toHaveLength(4)
    }
  })

  it('matches excerpts with the four periods', () => {
    const found = associations('audio-to-period')
    expect(found.length).toBeGreaterThan(10)
    for (const exercise of found)
      expect(new Set(Object.values(exercise.pairs))).toEqual(
        new Set(['baroque', 'classique', 'romantique', 'xxe']),
      )
  })

  it('matches concepts with their own definition, as text', () => {
    const exercise = build(concepts, 'fugue', 'concept-definition', 0, 1, true)
    if (exercise?.kind !== 'association') throw new Error(`Expected an association`)
    expect(Object.keys(exercise.pairs)).toContain('fugue')
    expect(Object.keys(exercise.pairs)).toHaveLength(4)
    expect(Object.entries(exercise.pairs).every(([left, right]) => left === right)).toBe(true)
    expect(isSensory(exercise)).toBe(false)
    expect(exerciseMediaIds(exercise, concepts)).toEqual([])
  })
})

describe('detail', () => {
  it('zooms in on the middle part of the painting and asks for the artist', () => {
    const details = SEEDS.map((seed) => build(art, 'renoir-2', 'image-to-artist', 0.8, seed))
    let count = 0
    for (const exercise of details) {
      if (exercise?.kind !== 'detail') continue
      count++
      expect(exercise.answerId).toBe('renoir')
      expect(exercise.optionIds).toContain('renoir')
      expect(exercise.mediaId).toBe('renoir-2-image')
      for (const value of [exercise.crop.x, exercise.crop.y]) {
        expect(value).toBeGreaterThanOrEqual(0.25)
        expect(value).toBeLessThanOrEqual(0.75)
      }
      expect(exercise.crop.zoom).toBeGreaterThan(1)
    }
    expect(count).toBeGreaterThan(10)
  })
})

describe('definitions', () => {
  it('hides the concept’s name and the words built on it', () => {
    expect(maskName('La fugue est savante', 'Fugue')).toBe('La … est savante')
    expect(maskName('Les sonates de Beethoven', 'Sonate')).toBe('Les … de Beethoven')
    expect(maskName('Les opéras de Verdi', 'Opéra')).toBe('Les … de Verdi')
    expect(maskName('Une préfugue', 'fugue')).toBe('Une préfugue')
  })

  it('keeps the first sentence of the summary', () => {
    expect(definitionOf(concepts.entity('fugue')!)).toBe(
      'La … fait entrer un thème voix après voix.',
    )
  })
})
