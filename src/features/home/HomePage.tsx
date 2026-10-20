import { use, useState } from 'react'
import { Link } from 'react-router'
import { AsyncBoundary } from '../../app/AsyncBoundary'
import { loadContentIndex, loadCourse } from '../../content/loader'
import { lessonStates } from '../../engine/progression'
import type { CourseId } from '../../schemas/content'
import { FlameIcon } from '../../ui/icons'

// Placeholder figures until progress storage arrives (phases 3 and 4).
const DEMO_STATS = { streakDays: 0, xpToday: 0, sessionsToday: 0, dailyGoal: 1 }

const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

/** Monday-based index of the current local day. */
const todayIndex = () => (new Date().getDay() + 6) % 7

export function HomePage() {
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

      <AsyncBoundary fallback={<HomeSkeleton />}>
        <HomeContent />
      </AsyncBoundary>
    </main>
  )
}

function HomeContent() {
  const index = use(loadContentIndex())
  const [courseId, setCourseId] = useState<CourseId | undefined>(index.courses[0]?.id)

  return (
    <>
      {index.courses.length > 1 && (
        <nav
          aria-label="Parcours"
          className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-surface p-1 ring-1 ring-line"
        >
          {index.courses.map((c) => (
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
      )}

      <DailyGoal />

      {courseId && (
        <AsyncBoundary
          fallback={<div className="mt-auto h-56 animate-pulse rounded-2xl bg-line" />}
        >
          <NextLesson courseId={courseId} />
        </AsyncBoundary>
      )}
    </>
  )
}

function DailyGoal() {
  const [today] = useState(todayIndex)
  const goalProgress = Math.min(1, DEMO_STATS.sessionsToday / DEMO_STATS.dailyGoal)

  return (
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
  )
}

function NextLesson({ courseId }: { courseId: CourseId }) {
  const course = use(loadCourse(courseId))
  // Nothing is completed until progress is stored (phase 3).
  const states = lessonStates(
    course.lessons.map((ref) => ref.lesson.id),
    new Set(),
  )
  const next = course.lessons.find((ref) => states.get(ref.lesson.id) === 'current')
  if (!next) return null

  const unitNumber = course.bundle.units.indexOf(next.unit) + 1
  const people = next.lesson.introduces
    .map((id) => course.entity(id))
    .filter((e) => e?.type === 'person')
    .map((e) => e?.name)

  return (
    <section
      aria-labelledby="next-title"
      className="mt-auto flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-[0.14em] text-gold uppercase">
          Unité {unitNumber} · {next.unit.title}
        </p>
        <h2 id="next-title" className="text-2xl">
          {next.lesson.title}
        </h2>
        <p className="text-muted">
          Leçon {next.index + 1} sur {course.lessons.length}
          {people.length > 0 && ` · avec ${people.join(', ')}`}
        </p>
      </div>
      <Link
        to={`/parcours/${courseId}`}
        className="flex min-h-13 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-ink transition-transform active:scale-[0.98]"
      >
        Continuer
      </Link>
    </section>
  )
}

function HomeSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-1 animate-pulse flex-col gap-8">
      <div className="h-40 rounded-2xl bg-line" />
      <div className="mt-auto h-56 rounded-2xl bg-line" />
    </div>
  )
}
