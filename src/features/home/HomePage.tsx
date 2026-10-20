import { useState } from 'react'
import { Link } from 'react-router'
import { FlameIcon } from '../../ui/icons'

// Placeholder data until the content pipeline (phase 2) and progress storage (phase 3) exist.
const COURSES = [
  {
    id: 'music',
    title: 'Musique classique',
    unit: 'Unité 1 · Les grands repères',
  },
  {
    id: 'art',
    title: 'Peinture occidentale',
    unit: 'Unité 1 · Grands mouvements de la peinture',
  },
] as const

type CourseId = (typeof COURSES)[number]['id']

const DEMO_STATS = { streakDays: 0, xpToday: 0, sessionsToday: 0, dailyGoal: 1 }

const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

/** Monday-based index of the current local day. */
const todayIndex = () => (new Date().getDay() + 6) % 7

export function HomePage() {
  const [courseId, setCourseId] = useState<CourseId>('music')
  const course = COURSES.find((c) => c.id === courseId) ?? COURSES[0]
  const [today] = useState(todayIndex)
  const goalProgress = Math.min(1, DEMO_STATS.sessionsToday / DEMO_STATS.dailyGoal)

  return (
    <main className="flex flex-1 flex-col gap-8 px-safe pt-safe pb-safe">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-[2rem] leading-none tracking-tight">Muse</h1>
        <p
          className="flex items-center gap-1.5 text-sm text-muted"
          aria-label={`Série de ${DEMO_STATS.streakDays} jour`}
        >
          <FlameIcon className="size-4 text-gold" />
          <span className="tabular-nums">{DEMO_STATS.streakDays}</span>
          <span>jour</span>
        </p>
      </header>

      <nav
        aria-label="Parcours"
        className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1 ring-1 ring-line"
      >
        {COURSES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.id === courseId}
            onClick={() => setCourseId(c.id)}
            className="min-h-11 rounded-full px-3 text-sm font-medium text-muted transition-colors aria-pressed:bg-line aria-pressed:text-ink"
          >
            {c.title}
          </button>
        ))}
      </nav>

      <section
        aria-labelledby="goal-title"
        className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 id="goal-title" className="text-lg">
              Objectif du jour
            </h2>
            <p className="text-sm text-muted tabular-nums">
              {DEMO_STATS.sessionsToday} / {DEMO_STATS.dailyGoal} session · {DEMO_STATS.xpToday} XP
            </p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-gold"
              style={{ width: `${goalProgress * 100}%` }}
            />
          </div>
        </div>

        <ol aria-label="Cette semaine" className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day, index) => (
            <li key={day} className="flex flex-col items-center gap-2">
              <span
                aria-hidden="true"
                data-today={index === today}
                className="text-xs text-muted data-[today=true]:font-semibold data-[today=true]:text-ink"
              >
                {day[0]}
              </span>
              <span
                aria-label={`${day} : objectif non atteint`}
                data-today={index === today}
                className="size-8 rounded-full border border-line data-[today=true]:border-2 data-[today=true]:border-gold"
              />
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="next-title"
        className="mt-auto flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6"
      >
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-[0.14em] text-gold uppercase">{course.unit}</p>
          <h2 id="next-title" className="text-2xl">
            Leçon de démonstration
          </h2>
          <p className="text-muted">Un exercice pour essayer : qui a peint ce tableau ?</p>
        </div>
        <Link
          to="/session/demo"
          className="flex min-h-13 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-ink transition-transform active:scale-[0.98]"
        >
          Continuer
        </Link>
      </section>
    </main>
  )
}
