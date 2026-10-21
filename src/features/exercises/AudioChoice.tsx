import { useState } from 'react'
import { mediaUrl } from '../../content/loader'
import type { ChoiceExercise } from '../../engine/exercises'
import { AudioButton } from './AudioButton'
import { ChoiceList } from './ChoiceList'
import { CHOICE_PROMPTS } from './copy'
import type { ExerciseProps } from './types'
import { useAnswerTimer } from './useAnswerTimer'
import { useRevealOnAnswer } from './useRevealOnAnswer'

/** Four-choice question on an excerpt: listen (as often as wanted), pick one answer. */
export function AudioChoice({ exercise, content, onAnswer }: ExerciseProps<ChoiceExercise>) {
  const [chosenId, setChosenId] = useState<string | null>(null)
  const elapsed = useAnswerTimer(exercise.id)
  const audio = content.asset(exercise.mediaId)
  const answered = chosenId !== null
  const choicesRef = useRevealOnAnswer<HTMLDivElement>(answered)

  return (
    <div className="flex flex-1 flex-col gap-6">
      <h2 className="text-2xl">{CHOICE_PROMPTS[exercise.skill]}</h2>

      <div className="flex flex-1 items-center justify-center py-2">
        {audio && <AudioButton src={mediaUrl(audio.src)} size={answered ? 'md' : 'lg'} />}
      </div>

      <div ref={choicesRef}>
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
