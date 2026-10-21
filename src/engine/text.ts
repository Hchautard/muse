// Text shown in exercises, derived from the content.
import type { Entity } from '../schemas/content'

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Replaces `name` (and words built on it: plurals, adjectives) with an ellipsis. */
export function maskName(text: string, name: string): string {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}\\p{L}*`, 'giu')
  return text.replace(pattern, '…')
}

/** First sentence of a concept's summary, without the concept's name (it would give it away). */
export function definitionOf(concept: Entity): string {
  const [first = concept.summary] = concept.summary.split(/(?<=[.!?])\s+/)
  return maskName(first, concept.name)
}
