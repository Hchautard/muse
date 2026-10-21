import { useState } from 'react'
import type { ChronologyExercise } from '../../engine/exercises'
import { CheckIcon, CrossIcon } from '../../ui/icons'
import { CHRONOLOGY_PROMPT } from './copy'
import type { ExerciseProps } from './types'
import { useAnswerTimer } from './useAnswerTimer'
import { useRevealOnAnswer } from './useRevealOnAnswer'

/**
 * Put works in chronological order by tapping them one after the other (no drag and drop,
 * unreliable on iOS Safari). Tapping a numbered work takes it out again.
 */
export function Chronology({ exercise, content, onAnswer }: ExerciseProps<ChronologyExercise>) {
  const [order, setOrder] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const elapsed = useAnswerTimer(exercise.id)
  const complete = order.length === exercise.itemIds.length
  const listRef = useRevealOnAnswer<HTMLOListElement>(submitted)

  function toggle(id: string) {
    setOrder((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
  }

  // Once checked, the works are shown in their true order, with their year.
  const shown = submitted ? exercise.answerIds : exercise.itemIds

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl">Remettez ces œuvres dans l’ordre</h2>
        <p className="text-muted">{CHRONOLOGY_PROMPT}</p>
      </div>

      <ol ref={listRef} className="flex flex-col gap-2.5">
        {shown.map((id, index) => {
          const work = content.entity(id)
          const creator = content.related(id, 'createdBy')
          const rank = order.indexOf(id) + 1
          const state = !submitted
            ? rank > 0
              ? 'picked'
              : 'idle'
            : rank === index + 1
              ? 'correct'
              : 'wrong'
          return (
            <li key={id}>
              <button
                type="button"
                disabled={submitted}
                aria-pressed={rank > 0}
                onClick={() => toggle(id)}
                data-state={state}
                className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-left transition-[transform,background-color,border-color] active:scale-[0.98] data-[state=correct]:border-success data-[state=correct]:bg-success-soft data-[state=picked]:border-accent data-[state=wrong]:border-danger data-[state=wrong]:bg-danger-soft"
              >
                <span
                  aria-hidden="true"
                  data-state={state}
                  className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-sm font-semibold tabular-nums data-[state=correct]:border-success data-[state=correct]:text-success data-[state=picked]:border-accent data-[state=picked]:bg-accent data-[state=picked]:text-accent-ink data-[state=wrong]:border-danger data-[state=wrong]:text-danger"
                >
                  {rank > 0 ? rank : ''}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[17px] leading-snug font-medium">{work?.name}</span>
                  {creator && <span className="text-sm text-muted">{creator.name}</span>}
                </span>
                {submitted && (
                  <span className="flex items-center gap-1.5 font-serif text-lg tabular-nums">
                    {work?.year}
                    {state === 'correct' ? (
                      <CheckIcon className="size-4 text-success" />
                    ) : (
                      <CrossIcon className="size-4 text-danger" />
                    )}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>

      {!submitted && (
        <button
          type="button"
          disabled={!complete}
          onClick={(event) => {
            setSubmitted(true)
            onAnswer({
              correct: order.every((id, i) => id === exercise.answerIds[i]),
              durationMs: elapsed(event),
            })
          }}
          className="mt-auto min-h-13 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink transition-[transform,opacity] active:scale-[0.98] disabled:opacity-40"
        >
          Valider
        </button>
      )}
    </div>
  )
}
