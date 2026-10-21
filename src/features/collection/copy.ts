// French wording shared by the collection and the statistics.
import { daysBetween, localDay } from '../../engine/calendar'
import type { MasteryStep } from '../../engine/collection'
import type { Skill } from '../../schemas/content'

export const SKILL_LABELS: Record<Skill, string> = {
  'audio-to-composer': 'Reconnaître le compositeur',
  'audio-to-period': 'Situer la période',
  'image-to-artist': 'Reconnaître le peintre',
  'image-to-movement': 'Reconnaître le mouvement',
  'work-to-date': 'Dater l’œuvre',
  'concept-definition': 'Définir la notion',
}

export const MASTERY_LABELS: Record<MasteryStep, string> = {
  1: 'Découverte',
  2: 'En cours',
  3: 'Solide',
  4: 'Maîtrisée',
}

const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })
const fullDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export const formatDay = (date: Date) => dayMonth.format(date)
export const formatDate = (date: Date) => fullDate.format(date)

/** "à revoir aujourd’hui", "demain", "dans 5 jours", "le 3 décembre". */
export function dueLabel(due: Date, now: Date): string {
  const days = daysBetween(localDay(now), localDay(due))
  if (days <= 0) return 'à revoir aujourd’hui'
  if (days === 1) return 'à revoir demain'
  if (days < 30) return `à revoir dans ${days} jours`
  return `à revoir le ${formatDay(due)}`
}
