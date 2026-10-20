// Turning Wikidata statements into fields to fill in content/entities/*.yaml.
import type { CourseId, EntityType } from '../../src/schemas/content'
import type { EntitySource } from './source-schemas'
import { fileFromFilePath, type SparqlRow } from './wikimedia'

const PROPERTIES = {
  composer: 'P86',
  creator: 'P170',
  inception: 'P571',
  movement: 'P135',
  image: 'P18',
  audio: 'P51',
  collection: 'P195',
  birth: 'P569',
  death: 'P570',
} as const

/** Day precision is 11, year 9, decade 8, century 7. */
const YEAR_PRECISION = 9

export interface DatedValue {
  year: number
  precision: number
}

export interface WikidataFacts {
  qid: string
  labelFr?: string
  labelEn?: string
  creators: string[]
  inception: DatedValue[]
  movements: string[]
  images: string[]
  audio: string[]
  collections: { qid: string; label?: string }[]
  birth: DatedValue[]
  death: DatedValue[]
}

/** One row per (item, property, value) so multi-valued properties do not multiply rows. */
export function buildFactsQuery(qids: string[]): string {
  return `SELECT ?item ?pid ?value ?precision ?valueFr ?valueEn ?labelFr ?labelEn WHERE {
  VALUES ?item { ${qids.map((q) => `wd:${q}`).join(' ')} }
  {
    OPTIONAL { ?item rdfs:label ?labelFr FILTER(lang(?labelFr) = "fr") }
    OPTIONAL { ?item rdfs:label ?labelEn FILTER(lang(?labelEn) = "en") }
  } UNION {
    VALUES ?pid { ${Object.values(PROPERTIES)
      .map((p) => `"${p}"`)
      .join(' ')} }
    BIND(IRI(CONCAT("http://www.wikidata.org/entity/", ?pid)) AS ?property)
    ?property wikibase:claim ?claim ; wikibase:statementProperty ?ps ; wikibase:statementValue ?psv .
    ?item ?claim ?statement .
    ?statement ?ps ?value ; wikibase:rank ?rank .
    FILTER(?rank != wikibase:DeprecatedRank)
    OPTIONAL { ?statement ?psv ?node . ?node wikibase:timePrecision ?precision }
    OPTIONAL { ?value rdfs:label ?valueFr FILTER(lang(?valueFr) = "fr") }
    OPTIONAL { ?value rdfs:label ?valueEn FILTER(lang(?valueEn) = "en") }
  }
}`
}

const entityId = (uri: string) => uri.split('/').pop() ?? uri

function parseYear(value: string): number | undefined {
  const match = /^([+-]?\d{1,6})-/.exec(value)
  return match?.[1] ? Number(match[1]) : undefined
}

export function parseFacts(rows: SparqlRow[]): Map<string, WikidataFacts> {
  const facts = new Map<string, WikidataFacts>()
  const get = (qid: string) => {
    let f = facts.get(qid)
    if (!f) {
      f = {
        qid,
        creators: [],
        inception: [],
        movements: [],
        images: [],
        audio: [],
        collections: [],
        birth: [],
        death: [],
      }
      facts.set(qid, f)
    }
    return f
  }
  const addUnique = <T>(list: T[], value: T, key: (v: T) => string = String) => {
    if (!list.some((v) => key(v) === key(value))) list.push(value)
  }

  for (const row of rows) {
    if (!row.item) continue
    const f = get(entityId(row.item))
    if (row.labelFr) f.labelFr = row.labelFr
    if (row.labelEn) f.labelEn = row.labelEn
    const { pid, value } = row
    if (!pid || !value) continue

    const dated = (): DatedValue | undefined => {
      const year = parseYear(value)
      return year === undefined
        ? undefined
        : { year, precision: Number(row.precision ?? YEAR_PRECISION) }
    }
    const datedKey = (d: DatedValue) => `${d.year}/${d.precision}`

    switch (pid) {
      case PROPERTIES.composer:
      case PROPERTIES.creator:
        addUnique(f.creators, entityId(value))
        break
      case PROPERTIES.movement:
        addUnique(f.movements, entityId(value))
        break
      case PROPERTIES.image:
        addUnique(f.images, fileFromFilePath(value))
        break
      case PROPERTIES.audio:
        addUnique(f.audio, fileFromFilePath(value))
        break
      case PROPERTIES.collection:
        addUnique(
          f.collections,
          { qid: entityId(value), label: row.valueFr ?? row.valueEn },
          (c) => c.qid,
        )
        break
      case PROPERTIES.inception:
      case PROPERTIES.birth:
      case PROPERTIES.death: {
        const d = dated()
        const list =
          pid === PROPERTIES.inception ? f.inception : pid === PROPERTIES.birth ? f.birth : f.death
        if (d) addUnique(list, d, datedKey)
        break
      }
    }
  }
  return facts
}

export interface KnownEntity {
  id: string
  type: EntityType
}

export interface IngestPlan {
  /** Fields to set on the entity, keyed by YAML path relative to the entity. */
  set: { path: string[]; value: unknown }[]
  conflicts: string[]
  notes: string[]
}

const earliest = (values: DatedValue[]) =>
  values.length ? values.reduce((a, b) => (b.year < a.year ? b : a)) : undefined

const asList = (value: string | string[] | undefined) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value]

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value) => b.includes(value))

/**
 * Computes what Wikidata can add to an entity. Values already written by hand are never
 * replaced: a disagreement is reported as a conflict instead.
 */
export function planIngest(
  entity: EntitySource,
  facts: WikidataFacts,
  course: CourseId,
  known: Map<string, KnownEntity>,
): IngestPlan {
  const plan: IngestPlan = { set: [], conflicts: [], notes: [] }
  const fill = (path: string[], value: unknown) => plan.set.push({ path, value })

  if (!facts.labelFr) plan.notes.push('pas de libellé français sur Wikidata')
  if (!entity.name) {
    const label = facts.labelFr ?? facts.labelEn
    if (label) fill(['name'], label)
    if (!facts.labelFr && facts.labelEn)
      plan.notes.push(`nom repris du libellé anglais « ${label} »`)
  }

  const fillYear = (
    field: 'year' | 'yearStart' | 'yearEnd',
    values: DatedValue[],
    what: string,
  ) => {
    const date = earliest(values)
    if (!date) return
    if (date.precision < YEAR_PRECISION)
      plan.notes.push(`${what} imprécise sur Wikidata (${date.year})`)
    const current = entity[field]
    if (current === undefined) fill([field], date.year)
    else if (!values.some((v) => v.year === current))
      plan.conflicts.push(
        `${what} : ${current} dans le contenu, ${values.map((v) => v.year).join(' / ')} sur Wikidata`,
      )
  }

  const fillRelation = (type: 'createdBy' | 'belongsTo' | 'inPeriod', ids: string[]) => {
    if (ids.length === 0) return
    const current = asList(entity.relations?.[type])
    if (current.length === 0) fill(['relations', type], ids.length === 1 ? ids[0] : ids)
    else if (!sameSet(current, ids))
      plan.conflicts.push(
        `${type} : ${current.join(', ')} dans le contenu, ${ids.join(', ')} d’après Wikidata`,
      )
  }

  // Movements may map to our movements (belongsTo) or to our periods (inPeriod).
  const movementTargets = facts.movements
    .map((qid) => known.get(qid))
    .filter((e) => e !== undefined)
  const movementIds = movementTargets.filter((e) => e.type === 'movement').map((e) => e.id)
  const periodIds = movementTargets.filter((e) => e.type === 'period').map((e) => e.id)

  if (entity.type === 'work') {
    fillYear('year', facts.inception, 'date de création')
    const creatorIds = facts.creators.flatMap((qid) => {
      const creator = known.get(qid)
      return creator?.type === 'person' ? [creator.id] : []
    })
    const unknownCreators = facts.creators.filter((qid) => known.get(qid)?.type !== 'person')
    fillRelation('createdBy', creatorIds)
    if (unknownCreators.length)
      plan.notes.push(`créateur(s) Wikidata absent(s) du contenu : ${unknownCreators.join(', ')}`)
    fillRelation('belongsTo', movementIds)
    fillRelation('inPeriod', periodIds)

    const collection = facts.collections[0]?.label
    if (collection && !entity.collection) fill(['collection'], collection)
    // Music works on Commons rarely have a meaningful P18 (scores, posters): only art works use it.
    if (course === 'art' && facts.images[0] && !entity.image) fill(['image'], facts.images[0])
    if (facts.audio[0] && !entity.audio) fill(['audio'], facts.audio[0])
  }

  if (entity.type === 'person') {
    fillYear('yearStart', facts.birth, 'date de naissance')
    fillYear('yearEnd', facts.death, 'date de mort')
    fillRelation('belongsTo', movementIds)
    fillRelation('inPeriod', periodIds)
    if (facts.images[0] && !entity.image) fill(['image'], facts.images[0])
  }

  return plan
}
