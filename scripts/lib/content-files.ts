// Reading and writing the files of the content pipeline.
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import YAML from 'yaml'
import { z } from 'zod'
import {
  audioManifestSchema,
  courseSourceSchema,
  entityFileSchema,
  mediaRegistrySchema,
  type MediaRegistry,
} from './source-schemas'

export const ROOT = join(import.meta.dirname, '..', '..')

export const PATHS = {
  courses: join(ROOT, 'content', 'courses'),
  entities: join(ROOT, 'content', 'entities'),
  manifests: join(ROOT, 'content', 'manifests'),
  registry: join(ROOT, 'content', 'generated', 'media.json'),
  publicContent: join(ROOT, 'public', 'content'),
  publicMedia: join(ROOT, 'public', 'media'),
  cache: join(ROOT, '.cache', 'media'),
  reports: join(ROOT, 'reports'),
}

/** An error in the content itself, reported without a stack trace. */
export class ContentError extends Error {}

/** Path relative to the repository root, with forward slashes, for messages. */
export const rel = (file: string) => relative(ROOT, file).replaceAll('\\', '/')

export async function listYamlFiles(dir: string, suffix = ''): Promise<string[]> {
  if (!existsSync(dir)) return []
  const names = await readdir(dir)
  return names
    .filter((name) => /\.ya?ml$/.test(name) && name.replace(/\.ya?ml$/, '').endsWith(suffix))
    .sort()
    .map((name) => join(dir, name))
}

export function parseYamlDocument(file: string, text: string): YAML.Document {
  const doc = YAML.parseDocument(text, { prettyErrors: true })
  if (doc.errors.length > 0)
    throw new ContentError(
      `${rel(file)} : YAML invalide\n${doc.errors.map((e) => e.message).join('\n')}`,
    )
  return doc
}

const LINE_WIDTH = 100

/**
 * Serializes an edited YAML document. Block scalars (summaries) are re-folded at 100 columns;
 * long plain or single-quoted strings (e.g. Commons file names) are double-quoted, which
 * `doubleQuotedAsJSON` keeps on one line.
 */
export function stringifyYamlDocument(doc: YAML.Document): string {
  YAML.visit(doc, {
    // Values added with setIn() are raw JS values, not nodes: wrap them so they are styled too.
    Pair(_, pair) {
      if (typeof pair.value === 'string') pair.value = new YAML.Scalar(pair.value)
    },
    Scalar(_, node) {
      const foldable =
        node.type === undefined || node.type === 'PLAIN' || node.type === 'QUOTE_SINGLE'
      if (foldable && typeof node.value === 'string' && node.value.length > 60)
        node.type = 'QUOTE_DOUBLE'
    },
  })
  return doc.toString({
    lineWidth: LINE_WIDTH,
    doubleQuotedAsJSON: true,
    flowCollectionPadding: false,
  })
}

export function validate<T>(file: string, schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) throw new ContentError(`${rel(file)}\n${z.prettifyError(result.error)}`)
  return result.data
}

async function loadYamlFiles<T>(dir: string, schema: z.ZodType<T>, suffix?: string) {
  const files = await listYamlFiles(dir, suffix)
  return Promise.all(
    files.map(async (file) => {
      const doc = parseYamlDocument(file, await readFile(file, 'utf8'))
      return { file, doc, data: validate(file, schema, doc.toJS()) }
    }),
  )
}

export const loadCourseFiles = () => loadYamlFiles(PATHS.courses, courseSourceSchema)
export const loadEntityFiles = () => loadYamlFiles(PATHS.entities, entityFileSchema)
export const loadAudioManifests = () =>
  loadYamlFiles(PATHS.manifests, audioManifestSchema, '-audio')

export async function loadRegistry(): Promise<MediaRegistry> {
  if (!existsSync(PATHS.registry)) return { assets: [] }
  return validate(
    PATHS.registry,
    mediaRegistrySchema,
    JSON.parse(await readFile(PATHS.registry, 'utf8')),
  )
}

export async function writeText(file: string, text: string) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, text)
}

export const writeJson = (file: string, value: unknown) =>
  writeText(file, `${JSON.stringify(value, null, 2)}\n`)

/** Runs a script, printing content errors plainly and exiting with status 1 on failure. */
export function runScript(main: () => Promise<void>) {
  main().catch((error: unknown) => {
    if (error instanceof ContentError) console.error(`\n✖ ${error.message}\n`)
    else console.error(error)
    process.exitCode = 1
  })
}
