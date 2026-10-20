// Provisional exercise shapes for phase 1; the engine will own the full Exercise union in phase 3.

export interface MediaCredit {
  credit: string
  license: string
  sourceUrl: string
}

export interface ExerciseImage extends MediaCredit {
  src: string
  variants: { width: number; src: string }[]
  alt: string
  width: number
  height: number
}

export interface ChoiceOption {
  id: string
  label: string
}

export interface ImageChoiceExercise {
  id: string
  kind: 'image-choice'
  prompt: string
  image: ExerciseImage
  /** Displayed in the given order; shuffling is the session builder's job. */
  options: ChoiceOption[]
  answerId: string
  /** Shown once the learner has answered. */
  reveal: { title: string; summary: string }
}

export interface ExerciseResult {
  correct: boolean
  durationMs: number
}
