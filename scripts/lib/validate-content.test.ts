import { describe, expect, it } from 'vitest'
import { makeBundle } from './test-fixtures'
import { validateCourseBundle } from './validate-content'

const allFilesExist = { mediaFileExists: () => true }

describe('validateCourseBundle', () => {
  it('accepts a consistent bundle', () => {
    expect(validateCourseBundle(makeBundle(), allFilesExist)).toEqual([])
  })

  it('reports duplicate entity ids', () => {
    const bundle = makeBundle()
    bundle.entities.push({ ...bundle.entities[0]! })
    expect(validateCourseBundle(bundle, allFilesExist)).toContain('Entité en double : « baroque »')
  })

  it('reports relations to unknown or wrongly typed entities', () => {
    const bundle = makeBundle()
    bundle.relations.push({ from: 'toccata', type: 'createdBy', to: 'mozart' })
    bundle.relations.push({ from: 'toccata', type: 'inPeriod', to: 'bach' })
    const errors = validateCourseBundle(bundle, allFilesExist)
    expect(errors).toContain('Relation toccata —createdBy→ mozart : cible inconnue')
    expect(errors).toContainEqual(
      expect.stringMatching(/inPeriod→ bach : la cible doit être de type period/),
    )
  })

  it('reports missing media files and unknown media ids', () => {
    const bundle = makeBundle()
    bundle.entities[1]!.mediaIds.push('ghost')
    const errors = validateCourseBundle(bundle, { mediaFileExists: (src) => !src.endsWith('.m4a') })
    expect(errors).toContain('Entité « bach » : média inconnu « ghost »')
    expect(errors).toContain(
      'Média « toccata-audio » : fichier absent public/media/music/audio/toccata-audio.m4a',
    )
  })

  it('reports entities introduced twice or unknown in lessons', () => {
    const bundle = makeBundle()
    bundle.units[0]!.lessons.push({
      id: 'l2',
      title: 'Encore',
      introduces: ['bach', 'nobody', 'toccata'],
      skills: ['work-to-date'],
    })
    const errors = validateCourseBundle(bundle, allFilesExist)
    expect(errors).toContain('Leçon « l2 » : entité inconnue « nobody »')
    expect(errors).toContain('Entité « bach » introduite deux fois (« l1 » et « l2 »)')
  })

  it('checks that introduced works can be exercised with the lesson skills', () => {
    const bundle = makeBundle()
    const toccata = bundle.entities[2]!
    toccata.mediaIds = []
    delete toccata.year
    bundle.relations = bundle.relations.filter((r) => r.from !== 'toccata')
    const errors = validateCourseBundle(bundle, allFilesExist)
    expect(errors).toEqual(
      expect.arrayContaining([
        'Leçon « l1 », œuvre « toccata » (audio-to-composer) : média audio manquant',
        'Leçon « l1 », œuvre « toccata » (audio-to-composer) : relation createdBy manquante',
        'Leçon « l1 », œuvre « toccata » (audio-to-period) : relation inPeriod manquante',
        'Leçon « l1 », œuvre « toccata » (work-to-date) : année manquante',
      ]),
    )
  })

  it('requires dates for people and periods', () => {
    const bundle = makeBundle()
    delete bundle.entities[1]!.yearEnd
    delete bundle.entities[0]!.yearStart
    const errors = validateCourseBundle(bundle, allFilesExist)
    expect(errors).toContain('Personne « bach » : dates de naissance et de mort requises')
    expect(errors).toContain('Période « baroque » : années de début et de fin requises')
  })
})
