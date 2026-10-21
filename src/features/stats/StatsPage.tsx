import { use, useMemo, useState } from 'react'
import { AsyncBoundary } from '../../app/AsyncBoundary'
import { loadCourses } from '../../content/loader'
import { useStatsData } from '../../db/hooks'
import type { ReviewLogRecord } from '../../db/db'
import { localDay } from '../../engine/calendar'
import { dueCards, type CardRecord } from '../../engine/cards'
import {
  CARD_LEVELS,
  countByLevel,
  longestStreak,
  weakPoints,
  xpHistory,
  type CardLevel,
  type Confusion,
} from '../../engine/stats'
import { currentStreak, type DayStats } from '../../engine/streak'
import { XpChart } from './XpChart'

/** Confusions older than this no longer count as weak points. */
const WEAK_POINTS_DAYS = 60

export function StatsPage() {
  // The review log is read from this instant on; fixed for the visit of the screen.
  const [since] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - WEAK_POINTS_DAYS)
    return date.toISOString()
  })
  const data = useStatsData(since)

  return (
    <main className="flex flex-1 flex-col gap-8 px-safe pt-safe pb-6">
      <h1 className="pt-2 text-[2rem] leading-none tracking-tight">Statistiques</h1>
      {data ? (
        <>
          <Totals days={data.days} />
          <XpChart history={xpHistory(data.days, localDay(new Date()))} />
          <CardLevels cards={data.cards} />
          <AsyncBoundary fallback={<SectionSkeleton />}>
            <WeakPoints logs={data.logs} />
          </AsyncBoundary>
        </>
      ) : (
        <SectionSkeleton />
      )}
    </main>
  )
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? 's' : ''}`

function formatMinutes(minutes: number) {
  const total = Math.round(minutes)
  if (total < 60) return `${total} min`
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')}`
}

function Totals({ days }: { days: DayStats[] }) {
  const today = localDay(new Date())
  const figures = [
    { label: 'Série actuelle', value: plural(currentStreak(days, today), 'jour') },
    { label: 'Meilleure série', value: plural(longestStreak(days), 'jour') },
    { label: 'XP au total', value: String(days.reduce((sum, d) => sum + d.xp, 0)) },
    { label: 'Temps d’étude', value: formatMinutes(days.reduce((sum, d) => sum + d.minutes, 0)) },
  ]
  return (
    <dl className="grid grid-cols-2 gap-3">
      {figures.map(({ label, value }) => (
        <div
          key={label}
          className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4"
        >
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="font-serif text-2xl tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

const LEVELS: Record<CardLevel, { label: string; hint: string; color: string }> = {
  learning: { label: 'En apprentissage', hint: 'encore fragiles', color: 'bg-accent/35' },
  consolidating: {
    label: 'En consolidation',
    hint: 'retenues plus d’une semaine',
    color: 'bg-gold/55',
  },
  mastered: { label: 'Maîtrisées', hint: 'retenues plus de trois semaines', color: 'bg-gold' },
}

function CardLevels({ cards }: { cards: CardRecord[] }) {
  const counts = countByLevel(cards)
  const due = dueCards(cards, new Date()).length

  return (
    <section aria-labelledby="cards-title" className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 id="cards-title" className="text-xl">
          Cartes
        </h2>
        <p className="text-sm text-muted tabular-nums">
          {plural(cards.length, 'carte')} · {due} à réviser
        </p>
      </div>
      {cards.length > 0 && (
        <div aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {CARD_LEVELS.filter((level) => counts[level] > 0).map((level) => (
            <span key={level} className={LEVELS[level].color} style={{ flexGrow: counts[level] }} />
          ))}
        </div>
      )}
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {CARD_LEVELS.map((level) => (
          <li key={level} className="flex items-center gap-3 py-3">
            <span
              aria-hidden="true"
              className={`size-3 shrink-0 rounded-full ${LEVELS[level].color}`}
            />
            <span className="flex flex-1 flex-col">
              <span className="font-medium">{LEVELS[level].label}</span>
              <span className="text-sm text-muted">{LEVELS[level].hint}</span>
            </span>
            <span className="font-serif text-xl tabular-nums">{counts[level]}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface NamedConfusion extends Confusion {
  names: [string, string]
  courseTitle: string
}

function WeakPoints({ logs }: { logs: ReviewLogRecord[] }) {
  const courses = use(loadCourses())
  const confusions = useMemo(() => {
    const named: NamedConfusion[] = courses.flatMap((course) =>
      weakPoints(logs.filter((log) => log.courseId === course.bundle.id)).map((c) => ({
        ...c,
        names: c.ids.map((id) => course.entity(id)?.name ?? id) as [string, string],
        courseTitle: course.bundle.title,
      })),
    )
    return named
      .sort((a, b) => b.count - a.count || b.lastAt.getTime() - a.lastAt.getTime())
      .slice(0, 5)
  }, [courses, logs])

  return (
    <section aria-labelledby="weak-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="weak-title" className="text-xl">
          Points faibles
        </h2>
        <p className="text-sm text-muted">
          Ce que vous confondez le plus souvent ({WEAK_POINTS_DAYS} derniers jours).
        </p>
      </div>
      {confusions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-5 text-center text-muted">
          Aucune confusion pour l’instant.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {confusions.map((c) => (
            <li
              key={`${c.courseTitle}:${c.ids.join('|')}`}
              className="flex items-center gap-3 py-3"
            >
              <span className="flex flex-1 flex-col">
                <span className="font-serif text-lg leading-snug">
                  {c.names[0]} <span className="text-muted">et</span> {c.names[1]}
                </span>
                {courses.length > 1 && <span className="text-sm text-muted">{c.courseTitle}</span>}
              </span>
              <span className="text-sm text-muted tabular-nums">{c.count} fois</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SectionSkeleton() {
  return <div aria-hidden="true" className="h-40 animate-pulse rounded-2xl bg-line" />
}
