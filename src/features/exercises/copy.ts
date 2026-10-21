// French wording of the exercises, per skill.
import type { Skill } from '../../schemas/content'

export const CHOICE_PROMPTS: Partial<Record<Skill, string>> = {
  'audio-to-composer': 'Qui a composé cette œuvre ?',
  'audio-to-period': 'De quelle période date cette œuvre ?',
  'image-to-artist': 'Qui a peint ce tableau ?',
  'image-to-movement': 'À quel mouvement appartient ce tableau ?',
}

/** First half of a true/false statement; the claimed entity's name completes it. */
export const STATEMENT_LEADS: Partial<Record<Skill, string>> = {
  'audio-to-composer': 'Cette œuvre est de',
  'audio-to-period': 'Cette œuvre date de la période',
  'image-to-artist': 'Ce tableau est de',
  'image-to-movement': 'Ce tableau appartient au mouvement',
}

export const CHRONOLOGY_PROMPT = 'De la plus ancienne à la plus récente'

export const ASSOCIATION_PROMPTS: Record<Skill, string> = {
  'audio-to-composer': 'Associez chaque extrait à son compositeur',
  'audio-to-period': 'Associez chaque extrait à sa période',
  'image-to-artist': 'Associez chaque tableau à son peintre',
  'image-to-movement': 'Associez chaque tableau à son mouvement',
  'work-to-date': 'Associez chaque œuvre à sa date',
  'concept-definition': 'Associez chaque notion à sa définition',
}

export const ASSOCIATION_HINTS = {
  audio: 'Touchez un extrait pour l’écouter, puis la bonne réponse.',
  image: 'Touchez un tableau, puis la bonne réponse.',
  text: 'Touchez une notion, puis sa définition.',
}

export const DETAIL_HINT = 'Seul un détail du tableau est visible.'
