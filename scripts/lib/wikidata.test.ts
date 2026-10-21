import { describe, expect, it } from 'vitest'
import YAML from 'yaml'
import { stringifyYamlDocument } from './content-files'
import { parseTimecode } from './source-schemas'
import { knownEntities, parseFacts, planIngest, type KnownEntity } from './wikidata'
import type { SparqlRow } from './wikimedia'

const WD = 'http://www.wikidata.org/entity/'
const FILE_PATH = 'http://commons.wikimedia.org/wiki/Special:FilePath/'

const rows: SparqlRow[] = [
  { item: `${WD}Q1`, labelFr: 'Toccata et fugue', labelEn: 'Toccata and Fugue' },
  { item: `${WD}Q1`, pid: 'P86', value: `${WD}Q10` },
  { item: `${WD}Q1`, pid: 'P86', value: `${WD}Q99` },
  { item: `${WD}Q1`, pid: 'P571', value: '1704-01-01T00:00:00Z', precision: '9' },
  { item: `${WD}Q1`, pid: 'P571', value: '1700-01-01T00:00:00Z', precision: '8' },
  { item: `${WD}Q1`, pid: 'P51', value: `${FILE_PATH}Toccata%20BWV565.ogg` },
  { item: `${WD}Q10`, labelEn: 'Johann Sebastian Bach' },
  { item: `${WD}Q10`, pid: 'P569', value: '1685-03-31T00:00:00Z', precision: '11' },
  { item: `${WD}Q10`, pid: 'P570', value: '1750-07-28T00:00:00Z', precision: '11' },
  { item: `${WD}Q10`, pid: 'P135', value: `${WD}Q20` },
  { item: `${WD}Q10`, pid: 'P18', value: `${FILE_PATH}Johann_Sebastian_Bach.png` },
]

const known = new Map<string, KnownEntity>([
  ['Q1', { id: 'toccata', type: 'work' }],
  ['Q10', { id: 'bach', type: 'person' }],
  ['Q20', { id: 'baroque', type: 'period' }],
])

describe('parseFacts', () => {
  it('groups statements per item and decodes Commons file names', () => {
    const facts = parseFacts(rows)
    const toccata = facts.get('Q1')!
    expect(toccata.labelFr).toBe('Toccata et fugue')
    expect(toccata.creators).toEqual(['Q10', 'Q99'])
    expect(toccata.inception).toEqual([
      { year: 1704, precision: 9 },
      { year: 1700, precision: 8 },
    ])
    expect(toccata.audio).toEqual(['File:Toccata BWV565.ogg'])
    expect(facts.get('Q10')!.images).toEqual(['File:Johann Sebastian Bach.png'])
  })
})

describe('planIngest', () => {
  const facts = parseFacts(rows)

  it('fills missing fields from Wikidata', () => {
    const plan = planIngest(
      { id: 'toccata', type: 'work', wikidataId: 'Q1' },
      facts.get('Q1')!,
      'music',
      known,
    )
    expect(plan.set).toEqual([
      { path: ['name'], value: 'Toccata et fugue' },
      { path: ['year'], value: 1700 },
      { path: ['relations', 'createdBy'], value: 'bach' },
      { path: ['audio'], value: 'File:Toccata BWV565.ogg' },
    ])
    expect(plan.notes).toContain('date de création imprécise sur Wikidata (1700)')
    expect(plan.notes).toContain('créateur(s) Wikidata absent(s) du contenu : Q99')
  })

  it('never overwrites hand-written values and reports disagreements', () => {
    const plan = planIngest(
      { id: 'toccata', type: 'work', wikidataId: 'Q1', name: 'Toccata', year: 1710 },
      facts.get('Q1')!,
      'music',
      known,
    )
    expect(plan.set.map((s) => s.path[0])).not.toContain('year')
    expect(plan.set.map((s) => s.path[0])).not.toContain('name')
    expect(plan.conflicts).toEqual([
      'date de création : 1710 dans le contenu, 1704 / 1700 sur Wikidata',
    ])
  })

  it('accepts any of several Wikidata dates without conflict', () => {
    const plan = planIngest(
      { id: 'toccata', type: 'work', wikidataId: 'Q1', year: 1704 },
      facts.get('Q1')!,
      'music',
      known,
    )
    expect(plan.conflicts).toEqual([])
  })

  it('maps people: dates, portrait, and movements onto known periods', () => {
    const plan = planIngest(
      { id: 'bach', type: 'person', wikidataId: 'Q10' },
      facts.get('Q10')!,
      'music',
      known,
    )
    expect(plan.set).toEqual([
      { path: ['name'], value: 'Johann Sebastian Bach' },
      { path: ['yearStart'], value: 1685 },
      { path: ['yearEnd'], value: 1750 },
      { path: ['relations', 'inPeriod'], value: 'baroque' },
      { path: ['image'], value: 'File:Johann Sebastian Bach.png' },
    ])
    expect(plan.notes).toContain('pas de libellé français sur Wikidata')
  })

  it('only takes images of music works for art courses', () => {
    const withImage = parseFacts([
      ...rows,
      { item: `${WD}Q1`, pid: 'P18', value: `${FILE_PATH}Score.jpg` },
    ]).get('Q1')!
    const music = planIngest(
      { id: 'toccata', type: 'work', wikidataId: 'Q1' },
      withImage,
      'music',
      known,
    )
    const art = planIngest(
      { id: 'toccata', type: 'work', wikidataId: 'Q1' },
      withImage,
      'art',
      known,
    )
    expect(music.set.some((s) => s.path[0] === 'image')).toBe(false)
    expect(art.set).toContainEqual({ path: ['image'], value: 'File:Score.jpg' })
  })

  it('leaves the Commons image out when a museum image is chosen', () => {
    const withImage = parseFacts([
      ...rows,
      { item: `${WD}Q1`, pid: 'P18', value: `${FILE_PATH}Painting.jpg` },
    ]).get('Q1')!
    const plan = planIngest(
      { id: 'painting', type: 'work', wikidataId: 'Q1', museumImage: 'aic:16568' },
      withImage,
      'art',
      known,
    )
    expect(plan.set.some((s) => s.path[0] === 'image')).toBe(false)
  })
})

describe('knownEntities', () => {
  it('keeps each course’s entities apart', () => {
    const known = knownEntities([
      {
        data: { course: 'music', entities: [{ id: 'ravel', type: 'person', wikidataId: 'Q1178' }] },
      },
      {
        data: {
          course: 'art',
          entities: [{ id: 'impressionnisme', type: 'movement', wikidataId: 'Q40415' }],
        },
      },
    ])
    expect(known.get('music')?.has('Q40415')).toBe(false)
    expect(known.get('art')?.get('Q40415')).toEqual({ id: 'impressionnisme', type: 'movement' })
  })
})

describe('YAML round trip', () => {
  it('keeps comments and hand-written formatting when fields are added', () => {
    const source = [
      '# Œuvres',
      'course: music',
      'entities:',
      '  - id: toccata # à vérifier',
      '    type: work',
      '    tags: [orgue]',
      '    summary: >-',
      '      Une pièce pour orgue.',
      '',
    ].join('\n')
    const doc = YAML.parseDocument(source)
    doc.setIn(['entities', 0, 'year'], 1700)
    doc.setIn(['entities', 0, 'relations', 'createdBy'], 'bach')
    doc.setIn(
      ['entities', 0, 'image'],
      'File:A very long Commons file name that would otherwise be folded by the YAML writer.jpg',
    )
    const out = stringifyYamlDocument(doc)
    expect(out).toContain('# Œuvres')
    expect(out).toContain('- id: toccata # à vérifier')
    expect(out).toContain('tags: [orgue]')
    expect(out).toContain('summary: >-')
    expect(out).toContain('year: 1700')
    expect(out).toContain('relations:\n      createdBy: bach')
    expect(out).toContain(
      'image: "File:A very long Commons file name that would otherwise be folded by the YAML writer.jpg"',
    )
    expect(YAML.parse(out).entities[0].relations).toEqual({ createdBy: 'bach' })
  })
})

describe('parseTimecode', () => {
  it('reads seconds and m:ss', () => {
    expect(parseTimecode(12)).toBe(12)
    expect(parseTimecode('8:00')).toBe(480)
    expect(parseTimecode('1:02.5')).toBe(62.5)
  })
})
