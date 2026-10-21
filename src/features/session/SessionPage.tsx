import { use, useState } from 'react'
import { Link, useParams } from 'react-router'
import { AsyncBoundary } from '../../app/AsyncBoundary'
import { NotFoundPage } from '../../app/NotFoundPage'
import type { CourseIndex } from '../../content/course-index'
import { ContentLoadError, isCourseId, loadCourse } from '../../content/loader'
import { loadCourseCards } from '../../db/progress'
import type { Exercise } from '../../engine/exercises'
import { buildSession, type SessionMode } from '../../engine/session'
import type { CourseId } from '../../schemas/content'
import { SessionRunner } from './SessionRunner'

export function LessonSessionPage() {
  const { courseId, lessonId } = useParams()
  if (!isCourseId(courseId) || !lessonId) return <NotFoundPage />
  return (
    <SessionScreen
      key={`${courseId}/${lessonId}`}
      courseId={courseId}
      mode={{ type: 'lesson', lessonId }}
    />
  )
}

export function ReviewSessionPage() {
  const { courseId } = useParams()
  if (!isCourseId(courseId)) return <NotFoundPage />
  return <SessionScreen key={courseId} courseId={courseId} mode={{ type: 'review' }} />
}

interface PreparedSession {
  content: CourseIndex
  exercises: Exercise[]
  startedAt: Date
}

async function prepareSession(courseId: CourseId, mode: SessionMode): Promise<PreparedSession> {
  const [content, cards] = await Promise.all([loadCourse(courseId), loadCourseCards(courseId)])
  if (mode.type === 'lesson' && !content.lesson(mode.lessonId))
    throw new ContentLoadError('Cette leçon n’existe pas.')
  const startedAt = new Date()
  return {
    content,
    startedAt,
    exercises: buildSession({ courseId, mode, now: startedAt, cards, content }),
  }
}

interface SessionScreenProps {
  courseId: CourseId
  mode: SessionMode
}

function SessionScreen({ courseId, mode }: SessionScreenProps) {
  // Created once per screen (not in the suspending child, which would recreate it on retry).
  const [prepared, setPrepared] = useState(() => prepareSession(courseId, mode))

  return (
    <AsyncBoundary
      fallback={<SessionSkeleton />}
      onRetry={() => setPrepared(prepareSession(courseId, mode))}
    >
      <PreparedRunner courseId={courseId} mode={mode} prepared={prepared} />
    </AsyncBoundary>
  )
}

function PreparedRunner({
  courseId,
  mode,
  prepared,
}: SessionScreenProps & { prepared: Promise<PreparedSession> }) {
  const { content, exercises, startedAt } = use(prepared)
  if (exercises.length === 0) return <NothingToReview />
  return (
    <SessionRunner
      courseId={courseId}
      mode={mode}
      content={content}
      exercises={exercises}
      startedAt={startedAt}
    />
  )
}

function NothingToReview() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-safe text-center">
      <h1 className="text-3xl">Rien à réviser</h1>
      <p className="text-muted">Terminez une leçon : ses œuvres reviendront ici au bon moment.</p>
      <Link
        to="/"
        replace
        className="min-h-11 rounded-full border border-line px-5 py-2.5 font-medium"
      >
        Retour à l’accueil
      </Link>
    </main>
  )
}

function SessionSkeleton() {
  return (
    <div aria-hidden="true" className="flex h-dvh animate-pulse flex-col gap-8 px-safe pt-safe">
      <div className="mt-4 h-2 rounded-full bg-line" />
      <div className="h-8 w-3/4 rounded bg-line" />
      <div className="mx-auto size-32 rounded-full bg-line" />
      <div className="mt-auto flex flex-col gap-2.5 pb-safe">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-13 rounded-xl bg-line" />
        ))}
      </div>
    </div>
  )
}
