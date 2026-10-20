// Fetches and validates the generated content. Promises are cached so that React's `use()`
// can suspend on them; a failed load is evicted so that it can be retried.
import { z } from 'zod'
import {
  contentIndexSchema,
  courseBundleSchema,
  type ContentIndex,
  type CourseId,
} from '../schemas/content'
import { createCourseIndex, type CourseIndex } from './course-index'

const contentUrl = (file: string) => `${import.meta.env.BASE_URL}content/${file}`

export class ContentLoadError extends Error {}

async function fetchJson<T>(file: string, schema: z.ZodType<T>): Promise<T> {
  let response: Response
  try {
    response = await fetch(contentUrl(file))
  } catch {
    throw new ContentLoadError('Impossible de joindre le serveur. Êtes-vous hors ligne ?')
  }
  if (!response.ok) throw new ContentLoadError(`Contenu introuvable (${response.status}).`)
  const result = schema.safeParse(await response.json())
  if (!result.success) {
    console.error(z.prettifyError(result.error))
    throw new ContentLoadError('Le contenu téléchargé est invalide.')
  }
  return result.data
}

const cache = new Map<string, Promise<unknown>>()

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  let promise = cache.get(key) as Promise<T> | undefined
  if (!promise) {
    promise = load()
    promise.catch(() => cache.delete(key))
    cache.set(key, promise)
  }
  return promise
}

export const loadContentIndex = (): Promise<ContentIndex> =>
  cached('index', () => fetchJson('index.json', contentIndexSchema))

export const loadCourse = (courseId: CourseId): Promise<CourseIndex> =>
  cached(`course:${courseId}`, async () => {
    const index = await loadContentIndex()
    const entry = index.courses.find((c) => c.id === courseId)
    if (!entry) throw new ContentLoadError('Ce parcours n’existe pas.')
    return createCourseIndex(await fetchJson(entry.file, courseBundleSchema))
  })

/** Forgets failed or stale loads, e.g. before a retry. */
export function resetContentCache() {
  cache.clear()
}

export const mediaUrl = (src: string) => `${import.meta.env.BASE_URL}media/${src}`
