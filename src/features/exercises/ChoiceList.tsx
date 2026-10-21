import type { MouseEvent } from 'react'
import { CheckIcon, CrossIcon } from '../../ui/icons'

export interface ChoiceOption {
  id: string
  label: string
}

interface ChoiceListProps {
  options: ChoiceOption[]
  answerId: string
  /** Null until the learner answers; the list then shows the verdict. */
  chosenId: string | null
  onChoose: (optionId: string, event: MouseEvent) => void
}

/** Four large answer buttons, within thumb reach. */
export function ChoiceList({ options, answerId, chosenId, onChoose }: ChoiceListProps) {
  const answered = chosenId !== null

  return (
    <ul className="flex flex-col gap-2.5">
      {options.map((option) => {
        const isAnswer = option.id === answerId
        const isChosen = option.id === chosenId
        const state = !answered ? 'idle' : isAnswer ? 'correct' : isChosen ? 'wrong' : 'dimmed'

        return (
          <li key={option.id}>
            <button
              type="button"
              disabled={answered}
              onClick={(event) => onChoose(option.id, event)}
              data-state={state}
              className="flex min-h-13 w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2 text-left text-[17px] font-medium transition-[transform,background-color,border-color,opacity] active:scale-[0.98] data-[state=correct]:border-success data-[state=correct]:bg-success-soft data-[state=correct]:text-success data-[state=dimmed]:opacity-45 data-[state=wrong]:border-danger data-[state=wrong]:bg-danger-soft data-[state=wrong]:text-danger"
            >
              <span>{option.label}</span>
              {state === 'correct' && <CheckIcon className="size-5 shrink-0" />}
              {state === 'wrong' && <CrossIcon className="size-5 shrink-0" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
