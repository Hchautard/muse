import { AudioChoice } from './AudioChoice'
import { Chronology } from './Chronology'
import { ImageChoice } from './ImageChoice'
import { TrueFalse } from './TrueFalse'
import type { ExerciseProps } from './types'

/** Picks the component for the exercise's kind. */
export function ExerciseView({ exercise, ...props }: ExerciseProps) {
  switch (exercise.kind) {
    case 'audio-choice':
      return <AudioChoice exercise={exercise} {...props} />
    case 'image-choice':
      return <ImageChoice exercise={exercise} {...props} />
    case 'true-false':
      return <TrueFalse exercise={exercise} {...props} />
    case 'chronology':
      return <Chronology exercise={exercise} {...props} />
  }
}
