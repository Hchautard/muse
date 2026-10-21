// Open access images from museum APIs (no key needed): the Art Institute of Chicago and The
// Metropolitan Museum of Art. Both publish their public domain works under CC0.
import { politeFetch } from './wikimedia'

export type Museum = 'aic' | 'met'

/** "aic:16568" or "met:435844": a museum and the object's id in its collection. */
export interface MuseumRef {
  museum: Museum
  objectId: number
}

export const MUSEUM_REF = /^(aic|met):(\d+)$/

export function parseMuseumRef(ref: string): MuseumRef | null {
  const match = MUSEUM_REF.exec(ref)
  return match ? { museum: match[1] as Museum, objectId: Number(match[2]) } : null
}

export interface MuseumImage {
  /** Image to download, at least 1600 px wide when the museum has it. */
  url: string
  /** Headers the museum asks for when downloading. */
  headers: Record<string, string>
  credit: string
  license: 'CC0'
  /** The object's page on the museum's website. */
  sourceUrl: string
  /** For the report: what the museum calls the work and its artist. */
  title: string
  artist: string
}

/** AIC serves IIIF images; public domain works are available at least 1686 px wide. */
const AIC_IMAGE_WIDTH = 1686
/** AIC asks API users to identify themselves; its image server rejects requests without it. */
const AIC_HEADERS = { 'AIC-User-Agent': 'MuseLearningApp (personal learning PWA)' }

export interface AicArtwork {
  data: {
    id: number
    title: string
    artist_title: string | null
    is_public_domain: boolean
    image_id: string | null
  }
  config: { iiif_url: string; website_url: string }
}

export interface MetObject {
  objectID: number
  title: string
  artistDisplayName: string
  isPublicDomain: boolean
  primaryImage: string
  objectURL: string
}

/** Reads an AIC artwork record; throws when the image is not public domain. */
export function aicImage({ data, config }: AicArtwork): MuseumImage {
  if (!data.is_public_domain)
    throw new Error(
      `l’Art Institute of Chicago ne place pas « ${data.title} » dans le domaine public`,
    )
  if (!data.image_id) throw new Error(`pas d’image pour « ${data.title} »`)
  return {
    url: `${config.iiif_url}/${data.image_id}/full/${AIC_IMAGE_WIDTH},/0/default.jpg`,
    headers: AIC_HEADERS,
    credit: 'Art Institute of Chicago',
    license: 'CC0',
    sourceUrl: `${config.website_url}/artworks/${data.id}`,
    title: data.title,
    artist: data.artist_title ?? '',
  }
}

/** Reads a Met object record; throws when the image is not in the Met's open access. */
export function metImage(object: MetObject): MuseumImage {
  if (!object.isPublicDomain)
    throw new Error(`le Met ne place pas « ${object.title} » dans le domaine public`)
  if (!object.primaryImage) throw new Error(`pas d’image pour « ${object.title} »`)
  return {
    url: object.primaryImage,
    headers: {},
    credit: 'The Metropolitan Museum of Art',
    license: 'CC0',
    sourceUrl: object.objectURL,
    title: object.title,
    artist: object.artistDisplayName,
  }
}

export async function fetchMuseumImage({ museum, objectId }: MuseumRef): Promise<MuseumImage> {
  if (museum === 'aic') {
    const fields = 'id,title,artist_title,is_public_domain,image_id'
    const response = await politeFetch(
      `https://api.artic.edu/api/v1/artworks/${objectId}?fields=${fields}`,
      AIC_HEADERS,
    )
    return aicImage((await response.json()) as AicArtwork)
  }
  const response = await politeFetch(
    `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`,
  )
  return metImage((await response.json()) as MetObject)
}
