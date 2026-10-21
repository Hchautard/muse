import { use, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { AsyncBoundary } from '../../app/AsyncBoundary'
import { NotFoundPage } from '../../app/NotFoundPage'
import type { CourseIndex, LessonRef } from '../../content/course-index'
import { isCourseId, loadCourse } from '../../content/loader'
import { useCompletedLessons } from '../../db/hooks'
import { lessonStates, type LessonState } from '../../engine/progression'
import type { CourseId } from '../../schemas/content'
import { ArrowLeftIcon, CheckIcon, LockIcon } from '../../ui/icons'
import { LessonSheet } from './LessonSheet'

export function CoursePage() {
  const { courseId } = useParams()
  if (!isCourseId(courseId)) return <NotFoundPage />

  return (
    <main className="flex flex-1 flex-col gap-6 px-safe pt-safe pb-6">
      <Link
        to="/"
        aria-label="Retour à l’accueil"
        className="-ml-2.5 grid size-11 place-items-center rounded-full text-muted"
      >
        <ArrowLeftIcon className="size-6" />
      </Link>
      <AsyncBoundary fallback={<CourseSkeleton />}>
        <CourseTree courseId={courseId} />
      </AsyncBoundary>
    </main>
  )
}

function CourseTree({ courseId }: { courseId: CourseId }) {
  const course = use(loadCourse(courseId))
  const [openLessonId, setOpenLessonId] = useState<string | null>(null)
  const completed = useCompletedLessons(courseId)
  const states = useMemo(
    () =>
      lessonStates(
        course.lessons.map((ref) => ref.lesson.id),
        completed ?? new Set(),
      ),
    [course, completed],
  )
  const openLesson = openLessonId ? course.lesson(openLessonId) : undefined

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl leading-tight">{course.bundle.title}</h1>
        <p className="text-muted">
          {course.lessons.length} leçons · {course.bundle.entities.length} œuvres et repères
        </p>
      </header>

      {course.bundle.units.map((unit, unitIndex) => (
        <section key={unit.id} aria-labelledby={`unit-${unit.id}`} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1 border-t border-line pt-6">
            <p className="text-xs font-medium tracking-[0.14em] text-gold uppercase">
              Unité {unitIndex + 1}
            </p>
            <h2 id={`unit-${unit.id}`} className="text-2xl">
              {unit.title}
            </h2>
            <p className="text-muted">{unit.description}</p>
          </div>

          <ol className="flex flex-col">
            {course.lessons
              .filter((ref) => ref.unit.id === unit.id)
              .map((ref, i, unitLessons) => (
                <LessonRow
                  key={ref.lesson.id}
                  course={course}
                  lessonRef={ref}
                  state={states.get(ref.lesson.id) ?? 'locked'}
                  isLast={i === unitLessons.length - 1}
                  onOpen={() => setOpenLessonId(ref.lesson.id)}
                />
              ))}
          </ol>
        </section>
      ))}

      {openLesson && (
        <LessonSheet
          courseId={courseId}
          course={course}
          lessonRef={openLesson}
          state={states.get(openLesson.lesson.id) ?? 'locked'}
          onClose={() => setOpenLessonId(null)}
        />
      )}
    </>
  )
}

const STATE_LABELS: Record<LessonState, string> = {
  completed: 'terminée',
  current: 'en cours',
  locked: 'verrouillée',
}

interface LessonRowProps {
  course: CourseIndex
  lessonRef: LessonRef
  state: LessonState
  isLast: boolean
  onOpen: () => void
}

function LessonRow({ course, lessonRef, state, isLast, onOpen }: LessonRowProps) {
  const { lesson, index } = lessonRef
  const introduced = lesson.introduces.map((id) => course.entity(id)).filter((e) => e !== undefined)
  const people = introduced.filter((e) => e.type === 'person').map((e) => e.name)
  const count = (type: string, word: string) => {
    const n = introduced.filter((e) => e.type === type).length
    return n > 0 ? `${n} ${word}${n > 1 ? 's' : ''}` : undefined
  }
  const summary = [...people, count('work', 'œuvre'), count('concept', 'notion')]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="relative">
      {!isLast && (
        <span
          aria-hidden="true"
          data-state={state}
          className="absolute top-12 bottom-0 left-[1.375rem] w-px bg-line data-[state=completed]:bg-gold"
        />
      )}
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-4 pb-6 text-left"
        aria-label={`Leçon ${index + 1}, ${lesson.title}, ${STATE_LABELS[state]}`}
      >
        <span
          data-state={state}
          className="relative grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted data-[state=completed]:border-gold data-[state=completed]:bg-gold data-[state=completed]:text-paper data-[state=current]:border-accent data-[state=current]:bg-accent data-[state=current]:font-semibold data-[state=current]:text-accent-ink"
        >
          {state === 'completed' && <CheckIcon className="size-5" />}
          {state === 'current' && <span className="tabular-nums">{index + 1}</span>}
          {state === 'locked' && <LockIcon className="size-4" />}
        </span>
        <span className="flex min-h-11 flex-col justify-center gap-0.5">
          <span
            data-state={state}
            className="font-serif text-lg leading-snug data-[state=locked]:text-muted"
          >
            {lesson.title}
          </span>
          <span className="text-sm text-muted">{summary}</span>
        </span>
      </button>
    </li>
  )
}

function CourseSkeleton() {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-6">
      <div className="h-9 w-2/3 rounded bg-line" />
      <div className="h-4 w-1/2 rounded bg-line" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="size-11 rounded-full bg-line" />
          <div className="h-5 w-1/2 rounded bg-line" />
        </div>
      ))}
    </div>
  )
}
