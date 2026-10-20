// Polite access to Wikidata and Wikimedia Commons: explicit User-Agent, one request per second,
// retries with back-off on 429 / 5xx (https://meta.wikimedia.org/wiki/User-Agent_policy).

const contact = process.env.WIKIMEDIA_CONTACT
export const USER_AGENT = `MuseLearningApp/0.1 (personal learning PWA${contact ? `; ${contact}` : ''}) node/${process.versions.node}`

/** upload.wikimedia.org throttles file downloads much harder than the APIs. */
const MIN_INTERVAL_MS: Record<string, number> = { 'upload.wikimedia.org': 5000 }
const DEFAULT_INTERVAL_MS = 1000
const MAX_ATTEMPTS = 4
/** Retry-After is always honoured; beyond this the run gives up and says when to retry. */
const MAX_RETRY_DELAY_SEC = 15 * 60
const lastRequestAt = new Map<string, number>()

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * `timeoutMs` covers the whole exchange, body included: callers streaming large files pass a
 * longer one.
 */
export async function politeFetch(
  url: string,
  headers: Record<string, string> = {},
  timeoutMs = 60_000,
) {
  const host = new URL(url).hostname
  const interval = MIN_INTERVAL_MS[host] ?? DEFAULT_INTERVAL_MS
  for (let attempt = 1; ; attempt++) {
    const wait = (lastRequestAt.get(host) ?? 0) + interval - Date.now()
    if (wait > 0) await sleep(wait)
    lastRequestAt.set(host, Date.now())

    let response: Response
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) throw error
      console.warn(`  … ${(error as Error).name} sur ${url}, nouvel essai`)
      await sleep(5000 * attempt)
      continue
    }

    const retryable = response.status === 429 || response.status >= 500
    if (retryable && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(response.headers.get('retry-after'))
      const delaySec = retryAfter > 0 ? retryAfter : 10 * 2 ** (attempt - 1)
      if (delaySec > MAX_RETRY_DELAY_SEC)
        throw new Error(
          `limite de débit Wikimedia (${host}) : relancer dans ${Math.ceil(delaySec / 60)} min`,
        )
      console.warn(`  … HTTP ${response.status} (${host}), nouvel essai dans ${delaySec} s`)
      await sleep(delaySec * 1000)
      continue
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} pour ${url}`)
    return response
  }
}

export type SparqlRow = Record<string, string>

export async function sparql(query: string): Promise<SparqlRow[]> {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`
  const response = await politeFetch(url, { Accept: 'application/sparql-results+json' })
  const json = (await response.json()) as {
    results: { bindings: Record<string, { value: string }>[] }
  }
  return json.results.bindings.map((binding) =>
    Object.fromEntries(Object.entries(binding).map(([key, { value }]) => [key, value])),
  )
}

export async function commonsApi<T>(params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams({ format: 'json', formatversion: '2', ...params })
  for (let attempt = 1; ; attempt++) {
    const response = await politeFetch(`https://commons.wikimedia.org/w/api.php?${query}`)
    const json = (await response.json()) as T & { error?: { code: string; info: string } }
    if (!json.error) return json
    // e.g. "ratelimited" or "cirrussearch-too-busy-error"
    if (attempt >= MAX_ATTEMPTS)
      throw new Error(`API Commons : ${json.error.code} — ${json.error.info}`)
    await sleep(10_000 * attempt)
  }
}

/** "File:X.ogg", a commons.wikimedia.org/wiki/File:… URL or an upload.wikimedia.org URL → "File:X.ogg". */
export function commonsTitle(source: string): string | null {
  if (source.startsWith('File:')) return source
  let url: URL
  try {
    url = new URL(source)
  } catch {
    return null
  }
  const decode = (segment: string) => decodeURIComponent(segment).replaceAll('_', ' ')
  if (url.hostname === 'commons.wikimedia.org') {
    const match = /^\/wiki\/(File:.+)$/.exec(url.pathname)
    return match?.[1] ? decode(match[1]) : null
  }
  if (url.hostname === 'upload.wikimedia.org' && !url.pathname.includes('/thumb/')) {
    const name = url.pathname.split('/').pop()
    return name ? `File:${decode(name)}` : null
  }
  return null
}

/** Wikidata P18/P51 values are Special:FilePath URLs. */
export function fileFromFilePath(value: string): string {
  return `File:${decodeURIComponent(value.split('/').pop() ?? '').replaceAll('_', ' ')}`
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Drops Commons' tracking parameters. */
export function cleanUrl(url: string): string {
  const parsed = new URL(url)
  for (const key of [...parsed.searchParams.keys()])
    if (key.startsWith('utm_')) parsed.searchParams.delete(key)
  return parsed.toString()
}
