import { masteryStep } from '../../engine/collection'
import { MASTERY_LABELS } from './copy'

const STEPS = [1, 2, 3, 4] as const

/** Four segments, filled up to the mastery step. */
export function MasteryBar({ value, className = '' }: { value: number; className?: string }) {
  const step = masteryStep(value)
  return (
    <span
      role="img"
      aria-label={`Maîtrise : ${MASTERY_LABELS[step].toLowerCase()}`}
      className={`flex gap-1 ${className}`}
    >
      {STEPS.map((s) => (
        <span
          key={s}
          data-on={s <= step}
          className="h-1 flex-1 rounded-full bg-line data-[on=true]:bg-gold"
        />
      ))}
    </span>
  )
}
