import { useEffect, useRef, useState } from 'react'
import { CheckIcon, CrossIcon } from '../../ui/icons'
import type { ExerciseResult, ImageChoiceExercise } from './types'
import { ZoomableImage } from './ZoomableImage'

const IMAGE_SHRINK_MS = 300

interface ImageChoiceProps {
  exercise: ImageChoiceExercise
  onAnswer: (result: ExerciseResult) => void
}

/** Multiple choice question about a painting: look at the image, pick one of four answers. */
export function ImageChoice({ exercise, onAnswer }: ImageChoiceProps) {
  const [chosenId, setChosenId] = useState<string | null>(null)
  const startedAt = useRef(0)
  const choicesRef = useRef<HTMLUListElement>(null)
  const answered = chosenId !== null

  useEffect(() => {
    startedAt.current = performance.now()
  }, [exercise.id])

  // Once the image has shrunk, bring the verdict on the choices into view above the feedback sheet.
  useEffect(() => {
    if (!answered) return
    const timer = setTimeout(
      () => choicesRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }),
      IMAGE_SHRINK_MS,
    )
    return () => clearTimeout(timer)
  }, [answered])

  // `answeredAt` is the click event's timeStamp, on the same clock as performance.now().
  function choose(optionId: string, answeredAt: number) {
    if (chosenId !== null) return
    setChosenId(optionId)
    onAnswer({
      correct: optionId === exercise.answerId,
      durationMs: Math.round(answeredAt - startedAt.current),
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <h2 className="text-2xl">{exercise.prompt}</h2>

      <ZoomableImage image={exercise.image} compact={answered} />

      <ul ref={choicesRef} className="mt-auto flex flex-col gap-2.5">
        {exercise.options.map((option) => {
          const isAnswer = option.id === exercise.answerId
          const isChosen = option.id === chosenId
          const state = !answered ? 'idle' : isAnswer ? 'correct' : isChosen ? 'wrong' : 'dimmed'

          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={answered}
                onClick={(event) => choose(option.id, event.timeStamp)}
                data-state={state}
                className="flex min-h-13 w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 text-left text-[17px] font-medium transition-[transform,background-color,border-color,opacity] active:scale-[0.98] data-[state=correct]:border-success data-[state=correct]:bg-success-soft data-[state=correct]:text-success data-[state=dimmed]:opacity-45 data-[state=wrong]:border-danger data-[state=wrong]:bg-danger-soft data-[state=wrong]:text-danger"
              >
                <span>{option.label}</span>
                {state === 'correct' && <CheckIcon className="size-5 shrink-0" />}
                {state === 'wrong' && <CrossIcon className="size-5 shrink-0" />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
