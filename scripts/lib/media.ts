// Downloading and converting media: WebP variants with sharp, AAC excerpts with ffmpeg.
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, rename, stat } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import sharp from 'sharp'
import { PATHS } from './content-files'
import { politeFetch } from './wikimedia'

const run = promisify(execFile)

export const IMAGE_WIDTHS = [480, 960, 1600]
const WEBP_QUALITY = 78
const FADE_SEC = 0.5
const TARGET_LUFS = -16
const LOUDNORM = `I=${TARGET_LUFS}:TP=-1.5:LRA=11`
/** Beyond this gap, linear gain was capped by the peak limit (e.g. 78 rpm clicks). */
const MAX_LOUDNESS_GAP_LU = 2
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000

/** Downloads a URL once into .cache/media/sources and returns the local path. */
export async function downloadCached(
  url: string,
  headers: Record<string, string> = {},
): Promise<string> {
  const ext = extname(new URL(url).pathname).toLowerCase() || '.bin'
  const file = join(PATHS.cache, 'sources', `${createHash('sha1').update(url).digest('hex')}${ext}`)
  if (existsSync(file)) return file

  await mkdir(dirname(file), { recursive: true })
  const response = await politeFetch(url, headers, DOWNLOAD_TIMEOUT_MS)
  if (!response.body) throw new Error(`réponse vide pour ${url}`)
  const partial = `${file}.part`
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial))
  await rename(partial, file)
  return file
}

export const fileSize = async (file: string) => (await stat(file)).size

export interface ImageOutput {
  src: string
  width: number
  height: number
  bytes: number
  variants: { width: number; src: string; bytes: number }[]
}

/** Writes WebP variants to public/media/<dir>/<id>-<width>.webp (never upscaled). */
export async function convertImage(input: string, dir: string, id: string): Promise<ImageOutput> {
  const metadata = await sharp(input).metadata()
  const originalWidth = metadata.width ?? IMAGE_WIDTHS[0]!
  const widths = IMAGE_WIDTHS.filter((w) => w <= originalWidth)
  if (widths.length === 0) widths.push(originalWidth)

  const variants: (ImageOutput['variants'][number] & { height: number })[] = []
  for (const width of widths) {
    const src = `${dir}/${id}-${width}.webp`
    const target = join(PATHS.publicMedia, src)
    await mkdir(dirname(target), { recursive: true })
    const info = await sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(target)
    variants.push({ width: info.width, src, bytes: info.size, height: info.height })
  }

  // The default source is the largest variant that is at most 960 px wide.
  const main = [...variants].reverse().find((v) => v.width <= 960) ?? variants[0]!
  return {
    src: main.src,
    width: main.width,
    height: main.height,
    bytes: main.bytes,
    variants: variants.map(({ width, src, bytes }) => ({ width, src, bytes })),
  }
}

export interface AudioOutput {
  src: string
  bytes: number
  durationSec: number
}

async function ffmpeg(args: string[]) {
  try {
    return await run('ffmpeg', ['-hide_banner', '-nostdin', ...args], {
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? ''
    throw new Error(`ffmpeg a échoué : ${stderr.trim().split('\n').slice(-3).join(' ')}`, {
      cause: error,
    })
  }
}

/** Runs loudnorm in analysis mode and returns its JSON report (input_i, input_tp…). */
async function measureLoudness(
  inputArgs: string[],
  filters: string[] = [],
): Promise<Record<string, string>> {
  const { stderr } = await ffmpeg([
    ...inputArgs,
    '-af',
    [...filters, `loudnorm=${LOUDNORM}:print_format=json`].join(','),
    '-f',
    'null',
    '-',
  ])
  const json = stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1)
  return JSON.parse(json) as Record<string, string>
}

/**
 * Cuts `duration` seconds from `start` (after skipping leading silence), normalizes loudness
 * with a two-pass loudnorm (dynamic as a fallback), adds 0.5 s fades and encodes AAC (.m4a).
 */
export async function cutAudioExcerpt(
  input: string,
  dir: string,
  id: string,
  start: number,
  duration: number,
): Promise<AudioOutput> {
  const src = `${dir}/${id}.m4a`
  const target = join(PATHS.publicMedia, src)
  await mkdir(dirname(target), { recursive: true })

  const head = [
    'silenceremove=start_periods=1:start_duration=0.05:start_threshold=-50dB',
    `atrim=duration=${duration}`,
    'asetpts=PTS-STARTPTS',
  ]
  // Decode a little more than needed so that silence removal still leaves a full excerpt.
  const inputArgs = ['-ss', String(start), '-t', String(duration + 30), '-i', input]

  const fades = [
    `afade=t=in:st=0:d=${FADE_SEC}`,
    `afade=t=out:st=${duration - FADE_SEC}:d=${FADE_SEC}`,
  ]
  const encode = (loudnorm: string) =>
    ffmpeg([
      '-y',
      '-loglevel',
      'error',
      ...inputArgs,
      '-af',
      [...head, loudnorm, ...fades].join(','),
      '-map_metadata',
      '-1',
      '-vn',
      '-ar',
      '44100',
      '-ac',
      '2',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      target,
    ])

  // Pass 1 measures, pass 2 applies a linear gain, which keeps the dynamics intact.
  const measured = await measureLoudness(inputArgs, head)
  await encode(
    [
      `loudnorm=${LOUDNORM}`,
      `measured_I=${measured.input_i}`,
      `measured_TP=${measured.input_tp}`,
      `measured_LRA=${measured.input_lra}`,
      `measured_thresh=${measured.input_thresh}`,
      `offset=${measured.target_offset}`,
      'linear=true',
    ].join(':'),
  )

  // When peaks prevent the linear gain from reaching the target, fall back to dynamic mode.
  const result = await measureLoudness(['-i', target])
  if (Math.abs(Number(result.input_i) - TARGET_LUFS) > MAX_LOUDNESS_GAP_LU)
    await encode(`loudnorm=${LOUDNORM}`)

  const probe = await run('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    target,
  ])
  const durationSec = Math.round(Number(probe.stdout.trim()) * 10) / 10
  if (!(durationSec >= duration - 1))
    throw new Error(`extrait trop court (${durationSec} s au lieu de ${duration} s)`)
  return { src, bytes: await fileSize(target), durationSec }
}
