import { useState } from 'react'
import type { ChoiceExercise } from '../../engine/exercises'
import { ChoiceList } from './ChoiceList'
import { CHOICE_PROMPTS } from './copy'
import type { ExerciseProps } from './types'
import { useAnswerTimer } from './useAnswerTimer'
import { useRevealOnAnswer } from './useRevealOnAnswer'
import { ZoomableImage } from './ZoomableImage'

const IMAGE_SHRINK_MS = 300

/** Four-choice question on a painting: look at the image (zoom allowed), pick one answer. */
export function ImageChoice({ exercise, content, onAnswer }: ExerciseProps<ChoiceExercise>) {
  const [chosenId, setChosenId] = useState<string | null>(null)
  const elapsed = useAnswerTimer(exercise.id)
  const image = content.asset(exercise.mediaId)
  const answered = chosenId !== null
  const choicesRef = useRevealOnAnswer<HTMLDivElement>(answered, IMAGE_SHRINK_MS)

  return (
    <div className="flex flex-1 flex-col gap-5">
      <h2 className="text-2xl">{CHOICE_PROMPTS[exercise.skill]}</h2>

      {image && <ZoomableImage image={image} alt="Œuvre à identifier" compact={answered} />}

      <div ref={choicesRef} className="mt-auto">
        <ChoiceList
          options={exercise.optionIds.map((id) => ({ id, label: content.entity(id)?.name ?? id }))}
          answerId={exercise.answerId}
          chosenId={chosenId}
          onChoose={(optionId, event) => {
            setChosenId(optionId)
            onAnswer({
              correct: optionId === exercise.answerId,
              durationMs: elapsed(event),
              chosenId: optionId,
            })
          }}
        />
      </div>
    </div>
  )
}
