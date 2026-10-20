// Downloads and converts the media referenced by content/ (entity images, audio excerpts),
// checks every license, and records credits in content/generated/media.json.
// Already processed assets are skipped unless their source changed.
import { existsSync } from 'node:fs'
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { CourseId } from '../src/schemas/content'
import { normalizeLicense } from '../src/schemas/licenses'
import {
  ContentError,
  loadAudioManifests,
  loadEntityFiles,
  loadRegistry,
  PATHS,
  rel,
  runScript,
  writeJson,
} from './lib/content-files'
import { convertImage, cutAudioExcerpt, downloadCached } from './lib/media'
import { parseTimecode, type RegistryAsset } from './lib/source-schemas'
import { cleanUrl, commonsApi, commonsTitle, stripHtml } from './lib/wikimedia'

/**
 * Above this size, use Commons' MP3 transcode (~170 kb/s, plenty for a 128 kb/s AAC excerpt)
 * instead of the original: lighter for us and for Wikimedia's servers.
 */
const MAX_AUDIO_DOWNLOAD_BYTES = 15_000_000
const MAX_CREDIT_LENGTH = 160
const COMMONS_BATCH_SIZE = 50

interface DesiredAsset {
  id: string
  kind: 'image' | 'audio'
  course: CourseId
  entityId: string
  origin: RegistryAsset['origin']
  overrides: { credit?: string; license?: string; sourceUrl?: string }
}

interface CommonsFile {
  title: string
  url: string
  descriptionUrl: string
  size: number
  width: number
  thumbUrl?: string
  mp3Url?: string
  license?: string
  artist?: string
  credit?: string
}

interface CommonsResponse {
  query?: {
    normalized?: { from: string; to: string }[]
    redirects?: { from: string; to: string }[]
    pages: {
      title: string
      missing?: boolean
      imageinfo?: {
        url: string
        descriptionurl: string
        size: number
        width: number
        thumburl?: string
        extmetadata?: Record<string, { value: string } | undefined>
      }[]
      videoinfo?: { derivatives?: { type: string; transcodekey?: string; src: string }[] }[]
    }[]
  }
}

async function fetchCommonsFiles(titles: string[]): Promise<Map<string, CommonsFile>> {
  const files = new Map<string, CommonsFile>()
  const unique = [...new Set(titles)]
  for (let i = 0; i < unique.length; i += COMMONS_BATCH_SIZE) {
    const batch = unique.slice(i, i + COMMONS_BATCH_SIZE)
    const response = await commonsApi<CommonsResponse>({
      action: 'query',
      titles: batch.join('|'),
      redirects: '1',
      prop: 'imageinfo|videoinfo',
      iiprop: 'url|size|extmetadata',
      iiurlwidth: '1600',
      iiextmetadatafilter: 'LicenseShortName|Artist|Credit',
      viprop: 'derivatives',
    })
    const query = response.query
    if (!query) continue
    // Map requested titles to the canonical ones the API answers with.
    const aliases = new Map<string, string>()
    for (const { from, to } of [...(query.normalized ?? []), ...(query.redirects ?? [])])
      aliases.set(from, to)
    const resolve = (title: string) => {
      let current = title
      while (aliases.has(current)) current = aliases.get(current)!
      return current
    }

    const pages = new Map(query.pages.map((page) => [page.title, page]))
    for (const title of batch) {
      const page = pages.get(resolve(title))
      const info = page?.imageinfo?.[0]
      if (!page || page.missing || !info) continue
      const meta = info.extmetadata ?? {}
      files.set(title, {
        title: page.title,
        url: cleanUrl(info.url),
        descriptionUrl: cleanUrl(info.descriptionurl),
        size: info.size,
        width: info.width,
        thumbUrl: info.thumburl ? cleanUrl(info.thumburl) : undefined,
        mp3Url: page.videoinfo?.[0]?.derivatives?.find((d) => d.transcodekey === 'mp3')?.src,
        license: meta.LicenseShortName?.value,
        artist: meta.Artist?.value ? stripHtml(meta.Artist.value) : undefined,
        credit: meta.Credit?.value ? stripHtml(meta.Credit.value) : undefined,
      })
    }
  }
  return files
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ') > max / 2 ? cut.lastIndexOf(' ') : cut.length)}…`
}

async function collectDesiredAssets(): Promise<DesiredAsset[]> {
  const [entityFiles, manifests] = await Promise.all([loadEntityFiles(), loadAudioManifests()])
  const entities = new Map(
    entityFiles.flatMap(({ data }) =>
      data.entities.map((e) => [e.id, { entity: e, course: data.course }]),
    ),
  )
  const desired: DesiredAsset[] = []
  const withExcerpt = new Set<string>()

  for (const { file, data } of manifests) {
    for (const excerpt of data.excerpts) {
      const target = entities.get(excerpt.entity)
      if (!target) throw new ContentError(`${rel(file)} : entité inconnue « ${excerpt.entity} »`)
      if (
        !commonsTitle(excerpt.source) &&
        !(excerpt.credit && excerpt.license && excerpt.sourceUrl)
      )
        throw new ContentError(
          `${rel(file)} : « ${excerpt.entity} » — credit, license et sourceUrl sont requis hors Commons`,
        )
      withExcerpt.add(excerpt.entity)
      desired.push({
        id: excerpt.id ?? `${excerpt.entity}-audio`,
        kind: 'audio',
        course: data.course,
        entityId: excerpt.entity,
        origin: {
          source: excerpt.source,
          start: parseTimecode(excerpt.start),
          duration: excerpt.duration,
        },
        overrides: {
          credit: excerpt.credit,
          license: excerpt.license,
          sourceUrl: excerpt.sourceUrl,
        },
      })
    }
  }

  for (const { entity, course } of entities.values()) {
    if (entity.image)
      desired.push({
        id: `${entity.id}-image`,
        kind: 'image',
        course,
        entityId: entity.id,
        origin: { source: entity.image },
        overrides: { credit: entity.imageCredit },
      })
    // Wikidata P51 recording, used from the start when no excerpt was chosen by hand.
    if (entity.audio && !withExcerpt.has(entity.id))
      desired.push({
        id: `${entity.id}-audio`,
        kind: 'audio',
        course,
        entityId: entity.id,
        origin: { source: entity.audio, start: 0, duration: 20 },
        overrides: {},
      })
  }

  const ids = desired.map((d) => d.id)
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i)
  if (duplicate)
    throw new ContentError(`Média en double : « ${duplicate} » (préciser un id dans le manifeste)`)
  return desired
}

function withOverrides(
  asset: RegistryAsset,
  overrides: DesiredAsset['overrides'],
): Pick<RegistryAsset, 'credit' | 'license' | 'sourceUrl'> {
  const license = overrides.license ? normalizeLicense(overrides.license) : asset.license
  if (!license) throw new ContentError(`${asset.id} : licence refusée « ${overrides.license} »`)
  return {
    credit: overrides.credit ? truncate(overrides.credit, MAX_CREDIT_LENGTH) : asset.credit,
    license,
    sourceUrl: overrides.sourceUrl ?? asset.sourceUrl,
  }
}

const sameOrigin = (a: RegistryAsset['origin'], b: RegistryAsset['origin']) =>
  a.source === b.source && a.start === b.start && a.duration === b.duration

const assetFiles = (asset: Pick<RegistryAsset, 'src' | 'variants'>) => [
  asset.src,
  ...(asset.variants ?? []).map((v) => v.src),
]

const isCached = (asset: RegistryAsset) =>
  assetFiles(asset).every((src) => existsSync(join(PATHS.publicMedia, src)))

async function processAsset(
  asset: DesiredAsset,
  commons: Map<string, CommonsFile>,
): Promise<RegistryAsset> {
  const title = commonsTitle(asset.origin.source)
  const file = title ? commons.get(title) : undefined
  if (title && !file) throw new Error(`fichier introuvable sur Commons : ${title}`)

  const rawLicense = asset.overrides.license ?? file?.license ?? ''
  const license = normalizeLicense(rawLicense)
  if (!license) throw new Error(`licence refusée : « ${rawLicense || 'inconnue'} »`)

  const credit = truncate(
    asset.overrides.credit ?? file?.artist ?? file?.credit ?? '',
    MAX_CREDIT_LENGTH,
  )
  if (!credit) throw new Error('crédit introuvable (ajouter « credit » dans le manifeste)')

  const sourceUrl = asset.overrides.sourceUrl ?? file?.descriptionUrl ?? asset.origin.source
  const dir = `${asset.course}/${asset.kind === 'image' ? 'images' : 'audio'}`
  const common = {
    id: asset.id,
    kind: asset.kind,
    course: asset.course,
    entityId: asset.entityId,
    origin: asset.origin,
    credit,
    license,
    sourceUrl,
  }

  if (asset.kind === 'image') {
    const input = await downloadCached(file?.thumbUrl ?? file?.url ?? asset.origin.source)
    return { ...common, ...(await convertImage(input, dir, asset.id)) }
  }

  const useTranscode = file && file.size > MAX_AUDIO_DOWNLOAD_BYTES && file.mp3Url
  const input = await downloadCached(
    useTranscode ? file.mp3Url! : (file?.url ?? asset.origin.source),
  )
  const excerpt = await cutAudioExcerpt(
    input,
    dir,
    asset.id,
    asset.origin.start ?? 0,
    asset.origin.duration ?? 20,
  )
  return { ...common, ...excerpt }
}

/** Deletes generated files that no asset references any more. */
async function pruneOrphans(assets: RegistryAsset[]): Promise<string[]> {
  if (!existsSync(PATHS.publicMedia)) return []
  const referenced = new Set(assets.flatMap(assetFiles))
  const removed: string[] = []
  const entries = await readdir(PATHS.publicMedia, { recursive: true, withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const src = rel(join(entry.parentPath, entry.name)).replace(/^public\/media\//, '')
    if (!referenced.has(src)) {
      await rm(join(PATHS.publicMedia, src))
      removed.push(src)
    }
  }
  return removed
}

runScript(async () => {
  const [desired, registry] = await Promise.all([collectDesiredAssets(), loadRegistry()])
  const previous = new Map(registry.assets.map((a) => [a.id, a]))

  const results: RegistryAsset[] = []
  const todo: DesiredAsset[] = []
  for (const asset of desired) {
    const known = previous.get(asset.id)
    if (known && sameOrigin(known.origin, asset.origin) && isCached(known))
      // Credit or license overrides apply without downloading the file again.
      results.push({ ...known, ...withOverrides(known, asset.overrides) })
    else todo.push(asset)
  }
  console.log(
    `Médias : ${desired.length} au total, ${results.length} déjà à jour, ${todo.length} à traiter.`,
  )

  const titles = todo.map((a) => commonsTitle(a.origin.source)).filter((t) => t !== null)
  const commons = await fetchCommonsFiles(titles)

  const saveRegistry = () =>
    writeJson(PATHS.registry, { assets: [...results].sort((a, b) => a.id.localeCompare(b.id)) })

  const problems: string[] = []
  for (const [index, asset] of todo.entries()) {
    const label = `[${index + 1}/${todo.length}] ${asset.id}`
    try {
      const result = await processAsset(asset, commons)
      results.push(result)
      // Saved after every asset so that an interrupted run keeps its progress.
      await saveRegistry()
      console.log(`✓ ${label} — ${result.license} — ${result.credit}`)
    } catch (error) {
      problems.push(`${asset.id} : ${(error as Error).message}`)
      console.log(`✖ ${label} — ${(error as Error).message}`)
    }
  }

  await saveRegistry()
  const removed = await pruneOrphans(results)
  if (removed.length) console.log(`Fichiers obsolètes supprimés : ${removed.join(', ')}`)

  if (problems.length)
    throw new ContentError(
      `${problems.length} média(s) refusé(s) ou en échec :\n- ${problems.join('\n- ')}`,
    )
  console.log(`\n✓ Registre écrit : ${rel(PATHS.registry)}`)
})
