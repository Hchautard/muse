import { use, useState } from 'react'
import { Link } from 'react-router'
import { AsyncBoundary } from '../../app/AsyncBoundary'
import { ChallengeCard } from '../challenge/ChallengeCard'
import { useChosenCourse } from '../../app/useChosenCourse'
import { loadContentIndex, loadCourse } from '../../content/loader'
import { useCompletedLessons, useDueCount, useTodayStats } from '../../db/hooks'
import { addDays, localDay } from '../../engine/calendar'
import { lessonStates } from '../../engine/progression'
import { isGoalMet } from '../../engine/streak'
import type { CourseId } from '../../schemas/content'
import { FlameIcon } from '../../ui/icons'
import { SegmentedControl } from '../../ui/SegmentedControl'

const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

/** Today and the Monday of this week, as local days; read once per visit of the screen. */
function currentWeek() {
  const now = new Date()
  const today = localDay(now)
  const index = (now.getDay() + 6) % 7
  return { today, index, monday: addDays(today, -index) }
}

export function HomePage() {
  const [week] = useState(currentWeek)
  const stats = useTodayStats(week.monday)
  const streak = stats?.streak ?? 0

  return (
    <main className="flex flex-1 flex-col gap-8 px-safe pt-safe pb-6">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-[2rem] leading-none tracking-tight">Muse</h1>
        <p
          className="flex items-center gap-1.5 text-sm text-muted"
          aria-label={`Série de ${streak} jour${streak > 1 ? 's' : ''}`}
        >
          <FlameIcon
            data-active={streak > 0}
            className="size-4 text-muted data-[active=true]:text-gold"
          />
          <span className="tabular-nums">{streak}</span>
          <span>jour{streak > 1 ? 's' : ''}</span>
        </p>
      </header>

      <DailyGoal week={week} stats={stats} />
      <ChallengeCard today={week.today} />

      <AsyncBoundary fallback={<CourseSkeleton />}>
        <HomeContent />
      </AsyncBoundary>
    </main>
  )
}

interface DailyGoalProps {
  week: ReturnType<typeof currentWeek>
  stats: ReturnType<typeof useTodayStats>
}

function DailyGoal({ week, stats }: DailyGoalProps) {
  const sessions = stats?.today?.sessions ?? 0
  const goal = stats?.goal ?? 1
  const xp = stats?.today?.xp ?? 0
  const metDays = new Set(stats?.days.filter(isGoalMet).map((d) => d.date))

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
            {Math.min(sessions, goal)} / {goal} session{goal > 1 ? 's' : ''} · {xp} XP
          </p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-gold transition-[width] duration-500"
            style={{ width: `${Math.min(1, sessions / goal) * 100}%` }}
          />
        </div>
      </div>

      <ol aria-label="Cette semaine" className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day, index) => {
          const met = metDays.has(addDays(week.monday, index))
          return (
            <li key={day} className="flex flex-col items-center gap-2">
              <span
                aria-hidden="true"
                data-today={index === week.index}
                className="text-xs text-muted data-[today=true]:font-semibold data-[today=true]:text-ink"
              >
                {day[0]}
              </span>
              <span
                aria-label={`${day} : objectif ${met ? 'atteint' : 'non atteint'}`}
                data-today={index === week.index}
                data-met={met}
                className="size-8 rounded-full border border-line data-[met=true]:border-gold data-[met=true]:bg-gold data-[today=true]:border-2 data-[today=true]:border-gold"
              />
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function HomeContent() {
  const index = use(loadContentIndex())
  const [courseId, setCourseId] = useChosenCourse(index.courses)

  return (
    <>
      {index.courses.length > 1 && (
        <div className="-mt-2">
          <SegmentedControl
            label="Parcours"
            options={index.courses.map((c) => ({ value: c.id, label: c.title }))}
            value={courseId}
            onChange={setCourseId}
          />
        </div>
      )}

      {courseId && (
        <AsyncBoundary fallback={<CourseSkeleton />}>
          <NextLesson key={courseId} courseId={courseId} />
        </AsyncBoundary>
      )}
    </>
  )
}

function NextLesson({ courseId }: { courseId: CourseId }) {
  const course = use(loadCourse(courseId))
  const completed = useCompletedLessons(courseId)
  const due = useDueCount(courseId) ?? 0
  if (!completed) return <CourseSkeleton />

  const states = lessonStates(
    course.lessons.map((ref) => ref.lesson.id),
    completed,
  )
  const next = course.lessons.find((ref) => states.get(ref.lesson.id) === 'current')
  const reviewLink = `/session/${courseId}/revision`

  return (
    <section
      aria-labelledby="next-title"
      className="mt-auto flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6"
    >
      {next ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-[0.14em] text-gold uppercase">
            Unité {course.bundle.units.indexOf(next.unit) + 1} · {next.unit.title}
          </p>
          <h2 id="next-title" className="text-2xl">
            {next.lesson.title}
          </h2>
          <p className="text-muted">
            Leçon {next.index + 1} sur {course.lessons.length}
            {peopleOf(course, next.lesson.introduces)}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-[0.14em] text-gold uppercase">
            {course.bundle.title}
          </p>
          <h2 id="next-title" className="text-2xl">
            Toutes les leçons sont terminées
          </h2>
          <p className="text-muted">Révisez pour garder ces repères bien en tête.</p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <Link
          to={next ? `/session/${courseId}/lecon/${next.lesson.id}` : reviewLink}
          className="flex min-h-13 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-ink transition-transform active:scale-[0.98]"
        >
          {next ? 'Continuer' : due > 0 ? `Réviser (${due})` : 'Réviser'}
        </Link>
        {next && due > 0 && (
          <Link
            to={reviewLink}
            className="flex min-h-13 items-center justify-center rounded-xl border border-line text-lg font-semibold transition-transform active:scale-[0.98]"
          >
            Réviser ({due})
          </Link>
        )}
        <Link
          to={`/parcours/${courseId}`}
          className="flex min-h-11 items-center justify-center text-sm font-medium text-muted"
        >
          Voir le parcours
        </Link>
      </div>
    </section>
  )
}

function peopleOf(course: Awaited<ReturnType<typeof loadCourse>>, ids: string[]) {
  const people = ids.map((id) => course.entity(id)).filter((e) => e?.type === 'person')
  return people.length > 0 ? ` · avec ${people.map((p) => p?.name).join(', ')}` : ''
}

function CourseSkeleton() {
  return <div aria-hidden="true" className="mt-auto h-64 animate-pulse rounded-2xl bg-line" />
}
