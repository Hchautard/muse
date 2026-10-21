// Offline download of a course: its media go straight into the service worker's caches, where the
// runtime routes (CacheFirst for media) will find them.
import type { CourseIndex } from '../../content/course-index'
import { mediaUrl } from '../../content/loader'

// Cache names of the runtime routes in vite.config.ts.
const MEDIA_CACHE = 'muse-media'
const CONTENT_CACHE = 'muse-content'
const PARALLEL_DOWNLOADS = 3

export interface OfflineFile {
  url: string
  bytes: number
}

export interface OfflineStatus {
  totalBytes: number
  cachedBytes: number
  fileCount: number
  cachedCount: number
}

export const offlineSupported = () => typeof caches !== 'undefined'

const absolute = (path: string) => new URL(path, document.baseURI).href

/** Every media file of the course: excerpts, and images in all their sizes. */
export function courseFiles(course: CourseIndex): OfflineFile[] {
  const files = new Map<string, number>()
  for (const asset of course.bundle.media)
    for (const { src, bytes } of [asset, ...(asset.variants ?? [])])
      files.set(absolute(mediaUrl(src)), bytes)
  return [...files].map(([url, bytes]) => ({ url, bytes }))
}

// Media responses may carry `Vary: Accept-Encoding`, while <audio> asks for them differently.
const MATCH = { ignoreVary: true }

export async function offlineStatus(course: CourseIndex): Promise<OfflineStatus> {
  const files = courseFiles(course)
  const cache = await caches.open(MEDIA_CACHE)
  const cached = await Promise.all(files.map((f) => cache.match(f.url, MATCH)))
  const present = files.filter((_, i) => cached[i] !== undefined)
  return {
    totalBytes: files.reduce((sum, f) => sum + f.bytes, 0),
    cachedBytes: present.reduce((sum, f) => sum + f.bytes, 0),
    fileCount: files.length,
    cachedCount: present.length,
  }
}

/**
 * Downloads what is missing, a few files at a time, and reports the bytes done so far. The course
 * file and the index are cached too, so that the app can start without network.
 */
export async function downloadCourse(
  course: CourseIndex,
  onProgress: (doneBytes: number, totalBytes: number) => void,
  signal: AbortSignal,
): Promise<void> {
  const contentCache = await caches.open(CONTENT_CACHE)
  const entry = absolute(`${import.meta.env.BASE_URL}content/index.json`)
  const index = await fetch(entry, { signal })
  if (!index.ok) throw new Error(`HTTP ${index.status} for ${entry}`)
  const { courses } = (await index.clone().json()) as { courses: { id: string; file: string }[] }
  await contentCache.put(entry, index)
  const file = courses.find((c) => c.id === course.bundle.id)?.file
  if (file) await contentCache.add(absolute(`${import.meta.env.BASE_URL}content/${file}`))

  const cache = await caches.open(MEDIA_CACHE)
  const files = courseFiles(course)
  const total = files.reduce((sum, f) => sum + f.bytes, 0)
  const cached = await Promise.all(files.map((f) => cache.match(f.url, MATCH)))
  const queue = files.filter((_, i) => cached[i] === undefined)
  let done = total - queue.reduce((sum, f) => sum + f.bytes, 0)
  onProgress(done, total)

  async function worker() {
    for (let next = queue.shift(); next; next = queue.shift()) {
      signal.throwIfAborted()
      const response = await fetch(next.url, { signal })
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${next.url}`)
      await cache.put(next.url, response)
      done += next.bytes
      onProgress(done, total)
    }
  }
  await Promise.all(Array.from({ length: PARALLEL_DOWNLOADS }, worker))
}

/** Removes the course's media from the cache (including files of older content versions). */
export async function freeCourse(course: CourseIndex): Promise<void> {
  const cache = await caches.open(MEDIA_CACHE)
  const prefix = absolute(mediaUrl(`${course.bundle.id}/`))
  const keys = await cache.keys()
  await Promise.all(keys.filter((r) => r.url.startsWith(prefix)).map((r) => cache.delete(r, MATCH)))
}

/** Space used by the app on this device (progress, caches…), when the browser tells. */
export async function storageUsage(): Promise<number | undefined> {
  try {
    return (await navigator.storage?.estimate())?.usage
  } catch {
    return undefined
  }
}

const megabytes = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

/** "11,2 Mo". */
export const formatBytes = (bytes: number) =>
  bytes < 100_000
    ? `${Math.max(1, Math.round(bytes / 1000))} ko`
    : `${megabytes.format(bytes / 1e6)} Mo`
