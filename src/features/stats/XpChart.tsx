import { useRef, useState, type PointerEvent } from 'react'
import type { DayXp } from '../../engine/stats'

const weekdayDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })

/** "2026-10-21" read as a local date, for display. */
const dateOf = (day: string) => {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, date ?? 1)
}

/**
 * XP of the last 30 days as bars; gold when the day's goal was reached. Touching or dragging
 * across the chart shows the figures of a day (the bars are too thin to be tapped one by one).
 */
export function XpChart({ history }: { history: DayXp[] }) {
  const [selected, setSelected] = useState(history.length - 1)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const max = Math.max(1, ...history.map((d) => d.xp))
  const total = history.reduce((sum, d) => sum + d.xp, 0)
  const day = history[selected] ?? history.at(-1)

  function pick(event: PointerEvent) {
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const ratio = (event.clientX - rect.left) / rect.width
    setSelected(Math.min(history.length - 1, Math.max(0, Math.floor(ratio * history.length))))
  }

  return (
    <section aria-labelledby="xp-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="xp-title" className="text-xl">
          XP sur 30 jours
        </h2>
        <p className="text-sm text-muted tabular-nums">{total} XP</p>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
        {day && (
          <p aria-live="polite" className="flex justify-between text-sm">
            <span className="text-muted first-letter:uppercase">
              {weekdayDate.format(dateOf(day.date))}
            </span>
            <span className="font-medium tabular-nums">
              {day.xp} XP{day.goalMet ? ' · objectif atteint' : ''}
            </span>
          </p>
        )}
        <div
          ref={surfaceRef}
          role="img"
          aria-label={`${total} XP gagnés sur les 30 derniers jours, ${history.filter((d) => d.goalMet).length} jours avec l’objectif atteint`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            pick(event)
          }}
          onPointerMove={(event) => {
            if (event.buttons > 0 || event.pointerType === 'touch') pick(event)
          }}
          className="flex h-32 touch-pan-y items-end gap-0.5 select-none"
        >
          {history.map((d, index) => (
            <span
              key={d.date}
              data-selected={index === selected}
              className={`min-h-0.5 flex-1 rounded-t-sm data-[selected=true]:outline-2 data-[selected=true]:outline-offset-1 data-[selected=true]:outline-ink/40 ${
                d.goalMet ? 'bg-gold' : d.xp > 0 ? 'bg-muted/50' : 'bg-line'
              }`}
              style={{ height: `${(d.xp / max) * 100}%` }}
            />
          ))}
        </div>
        <p aria-hidden="true" className="flex justify-between text-xs text-muted">
          <span>{history[0] && dayMonth.format(dateOf(history[0].date))}</span>
          <span>Aujourd’hui</span>
        </p>
      </div>
    </section>
  )
}
