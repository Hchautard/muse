import { useState, type MouseEvent, type ReactNode } from 'react'
import { mediaUrl } from '../../content/loader'
import type { AssociationExercise, Mismatch } from '../../engine/exercises'
import { SKILL_SPECS } from '../../engine/skills'
import { definitionOf } from '../../engine/text'
import { CheckIcon, PauseIcon, PlayIcon } from '../../ui/icons'
import { useAudioPreview } from '../../ui/useAudioPreview'
import { ASSOCIATION_HINTS, ASSOCIATION_PROMPTS } from './copy'
import type { ExerciseProps } from './types'
import { useAnswerTimer } from './useAnswerTimer'

type Side = 'left' | 'right'
type ItemState = 'idle' | 'selected' | 'matched' | 'wrong'

const ITEM_CLASS =
  'w-full rounded-xl border border-line bg-surface text-left transition-[transform,background-color,border-color,opacity] active:scale-[0.98] data-[state=matched]:border-success/50 data-[state=matched]:bg-success-soft data-[state=selected]:border-accent data-[state=selected]:ring-1 data-[state=selected]:ring-accent data-[state=wrong]:animate-shake data-[state=wrong]:border-danger data-[state=wrong]:bg-danger-soft'

/**
 * Four pairs to match by taps: an item on one side, then its partner on the other. A wrong
 * pairing is shown and counted, and the learner tries again until every pair is found.
 * Excerpts face their answers in two columns; paintings and concepts sit above their answers.
 */
export function Association({ exercise, content, onAnswer }: ExerciseProps<AssociationExercise>) {
  const [selected, setSelected] = useState<{ side: Side; id: string } | null>(null)
  const [matched, setMatched] = useState<string[]>([])
  const [wrong, setWrong] = useState<{ left: string; right: string } | null>(null)
  const [mismatches, setMismatches] = useState<Mismatch[]>([])
  const elapsed = useAnswerTimer(exercise.id)
  const { playingId, toggle } = useAudioPreview()
  const media = SKILL_SPECS[exercise.skill].media
  const done = matched.length === exercise.leftIds.length
  const matchedRight = new Set(matched.map((left) => exercise.pairs[left]))

  const isMatched = (side: Side, id: string) =>
    side === 'left' ? matched.includes(id) : matchedRight.has(id)

  function stateOf(side: Side, id: string): ItemState {
    if (isMatched(side, id)) return 'matched'
    if (wrong?.[side] === id) return 'wrong'
    if (selected?.side === side && selected.id === id) return 'selected'
    return 'idle'
  }

  function play(id: string) {
    const work = content.entity(id)
    const audio = work && content.media(work, 'audio')
    if (audio) toggle(id, mediaUrl(audio.src))
  }

  function tap(side: Side, id: string, event: MouseEvent) {
    if (done) return
    setWrong(null)
    if (isMatched(side, id)) {
      // A matched excerpt can still be heard again.
      if (side === 'left' && media === 'audio') play(id)
      return
    }
    if (!selected || selected.side === side) {
      setSelected({ side, id })
      if (side === 'left' && media === 'audio') play(id)
      return
    }

    const left = side === 'left' ? id : selected.id
    const right = side === 'right' ? id : selected.id
    setSelected(null)
    if (exercise.pairs[left] === right) {
      const next = [...matched, left]
      setMatched(next)
      if (next.length === exercise.leftIds.length)
        onAnswer({ correct: mismatches.length === 0, durationMs: elapsed(event), mismatches })
      return
    }
    setWrong({ left, right })
    setMismatches([...mismatches, { expectedId: exercise.pairs[left] ?? left, chosenId: right }])
  }

  /** A tappable item; `label` names it for screen readers when its content does not. */
  function item(side: Side, id: string, className: string, children: ReactNode, label?: string) {
    const state = stateOf(side, id)
    return (
      <li key={id}>
        <button
          type="button"
          onClick={(event) => tap(side, id, event)}
          data-state={state}
          aria-pressed={state === 'selected'}
          aria-label={label}
          className={`${ITEM_CLASS} ${className}`}
        >
          {children}
        </button>
      </li>
    )
  }

  const answerName = (left: string) => content.entity(exercise.pairs[left] ?? '')?.name
  const answers = exercise.rightIds.map((id) =>
    item(
      'right',
      id,
      'flex min-h-14 items-center justify-between gap-2 px-3.5 py-2 leading-snug font-medium hyphens-auto data-[state=matched]:opacity-60',
      <>
        {content.entity(id)?.name}
        {isMatched('right', id) && <CheckIcon className="size-4 shrink-0 text-success" />}
      </>,
    ),
  )

  const errors = mismatches.length
  const header = (
    <div className="flex flex-col gap-1">
      <h2 className="text-2xl">{ASSOCIATION_PROMPTS[exercise.skill]}</h2>
      <p className="text-muted" aria-live="polite">
        {errors === 0
          ? ASSOCIATION_HINTS[media ?? 'text']
          : `${errors} erreur${errors > 1 ? 's' : ''}${done ? '' : ' · réessayez'}`}
      </p>
    </div>
  )

  if (media === 'audio') {
    return (
      <div className="flex flex-1 flex-col gap-5">
        {header}
        <div className="grid grid-cols-2 gap-x-3">
          <ul className="flex flex-col gap-2.5">
            {exercise.leftIds.map((id, index) => {
              const playing = playingId === id
              const found = isMatched('left', id)
              const label = `Extrait ${index + 1}`
              return item(
                'left',
                id,
                'flex min-h-14 items-center gap-3 px-2.5 py-2',
                <>
                  <span
                    aria-hidden="true"
                    data-playing={playing}
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent data-[playing=true]:bg-accent data-[playing=true]:text-accent-ink"
                  >
                    {playing ? (
                      <PauseIcon className="size-4" />
                    ) : (
                      <PlayIcon className="ml-0.5 size-4" />
                    )}
                  </span>
                  <span aria-hidden="true" className="flex min-w-0 flex-col leading-tight">
                    <span className="font-medium">{label}</span>
                    {found && (
                      <span className="truncate text-sm font-medium text-success">
                        {answerName(id)}
                      </span>
                    )}
                  </span>
                </>,
                `${label}${playing ? ', en lecture' : ''}${found ? `, ${answerName(id)}` : ''}`,
              )
            })}
          </ul>
          <ul className="flex flex-col gap-2.5">{answers}</ul>
        </div>
      </div>
    )
  }

  if (media === 'image') {
    return (
      <div className="flex flex-1 flex-col gap-5">
        {header}
        <ul className="grid grid-cols-2 gap-2.5">
          {exercise.leftIds.map((id, index) => {
            const work = content.entity(id)
            const image = work && content.media(work, 'image')
            const thumb = image?.variants?.[0] ?? image
            const found = isMatched('left', id)
            return item(
              'left',
              id,
              'relative aspect-square overflow-hidden p-0',
              <>
                {thumb && (
                  <img
                    src={mediaUrl(thumb.src)}
                    alt=""
                    draggable={false}
                    className="size-full bg-line object-cover select-none"
                  />
                )}
                {found && (
                  <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-success px-2.5 py-1.5 text-sm font-medium text-paper">
                    <CheckIcon className="size-4 shrink-0" />
                    <span className="truncate">{answerName(id)}</span>
                  </span>
                )}
              </>,
              `Tableau ${index + 1}${found ? `, ${answerName(id)}` : ''}`,
            )
          })}
        </ul>
        <ul className="grid grid-cols-2 gap-2.5">{answers}</ul>
      </div>
    )
  }

  // Concepts: short names above, their definitions below.
  return (
    <div className="flex flex-1 flex-col gap-5">
      {header}
      <ul className="grid grid-cols-2 gap-2.5">
        {exercise.leftIds.map((id) =>
          item(
            'left',
            id,
            'flex min-h-13 items-center justify-between gap-2 px-4 py-2 font-medium',
            <>
              {content.entity(id)?.name}
              {isMatched('left', id) && <CheckIcon className="size-4 shrink-0 text-success" />}
            </>,
          ),
        )}
      </ul>
      <ul className="flex flex-col gap-2.5">
        {exercise.rightIds.map((id) => {
          const concept = content.entity(id)
          return item(
            'right',
            id,
            'flex min-h-14 flex-col gap-0.5 px-4 py-3 text-[15px] leading-snug',
            <>
              {isMatched('right', id) && (
                <span className="font-semibold text-success">{concept?.name}</span>
              )}
              <span>{concept && definitionOf(concept)}</span>
            </>,
          )
        })}
      </ul>
    </div>
  )
}
