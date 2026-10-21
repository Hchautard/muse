import { useState } from 'react'
import { mediaUrl } from '../../content/loader'
import type { TrueFalseExercise } from '../../engine/exercises'
import { CheckIcon, CrossIcon } from '../../ui/icons'
import { AudioButton } from './AudioButton'
import { STATEMENT_LEADS } from './copy'
import type { ExerciseProps } from './types'
import { useAnswerTimer } from './useAnswerTimer'
import { useRevealOnAnswer } from './useRevealOnAnswer'
import { ZoomableImage } from './ZoomableImage'

const CHOICES = [
  { value: true, label: 'Vrai' },
  { value: false, label: 'Faux' },
] as const

/** A statement about the excerpt or painting, true or falsified: the learner says which. */
export function TrueFalse({ exercise, content, onAnswer }: ExerciseProps<TrueFalseExercise>) {
  const [choice, setChoice] = useState<boolean | null>(null)
  const elapsed = useAnswerTimer(exercise.id)
  const media = content.asset(exercise.mediaId)
  const claim = content.entity(exercise.claimId)
  const truth = exercise.claimId === exercise.answerId
  const answered = choice !== null
  const choicesRef = useRevealOnAnswer<HTMLDivElement>(answered, 300)

  return (
    <div className="flex flex-1 flex-col gap-6">
      <h2 className="text-2xl">Vrai ou faux ?</h2>

      <div className="flex flex-1 items-center justify-center py-2">
        {media?.kind === 'audio' && (
          <AudioButton src={mediaUrl(media.src)} size={answered ? 'md' : 'lg'} />
        )}
        {media?.kind === 'image' && (
          <ZoomableImage image={media} alt="Œuvre à identifier" compact={answered} />
        )}
      </div>

      <figure className="flex flex-col gap-1 rounded-2xl border border-line bg-surface px-5 py-4 text-center">
        <p className="text-muted">{STATEMENT_LEADS[exercise.skill]}</p>
        <p className="font-serif text-2xl leading-snug">{claim?.name}</p>
      </figure>

      <div ref={choicesRef} className="grid grid-cols-2 gap-3">
        {CHOICES.map(({ value, label }) => {
          const state = !answered
            ? 'idle'
            : value === truth
              ? 'correct'
              : value === choice
                ? 'wrong'
                : 'dimmed'
          return (
            <button
              key={label}
              type="button"
              disabled={answered}
              data-state={state}
              onClick={(event) => {
                setChoice(value)
                onAnswer({
                  correct: value === truth,
                  durationMs: elapsed(event),
                  chosenId: value ? exercise.claimId : undefined,
                })
              }}
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-lg font-semibold transition-[transform,background-color,border-color,opacity] active:scale-[0.98] data-[state=correct]:border-success data-[state=correct]:bg-success-soft data-[state=correct]:text-success data-[state=dimmed]:opacity-45 data-[state=wrong]:border-danger data-[state=wrong]:bg-danger-soft data-[state=wrong]:text-danger"
            >
              {state === 'correct' && <CheckIcon className="size-5" />}
              {state === 'wrong' && <CrossIcon className="size-5" />}
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
