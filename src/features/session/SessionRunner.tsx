import { useEffect, useReducer, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { CourseIndex } from '../../content/course-index'
import { mediaUrl } from '../../content/loader'
import { saveSession } from '../../db/progress'
import type { Exercise, ExerciseResult } from '../../engine/exercises'
import {
  advance,
  currentExercise,
  isAnswered,
  isFinished,
  recordAnswer,
  runProgress,
  startRun,
  summarizeRun,
  type SessionRun,
} from '../../engine/run'
import type { SessionMode } from '../../engine/session'
import type { CourseId } from '../../schemas/content'
import { preloadMedia } from '../../ui/audio'
import { BottomSheet } from '../../ui/BottomSheet'
import { CloseIcon } from '../../ui/icons'
import { AnswerFeedback } from '../exercises/AnswerFeedback'
import { ExerciseView } from '../exercises/ExerciseView'
import { feedbackFor } from './feedback'
import { IntroCard } from './IntroCard'
import { SessionEnd } from './SessionEnd'

interface State {
  run: SessionRun
  /** The current exercise's work is being presented (first encounter). */
  presenting: boolean
}

type Action =
  | { type: 'presented' }
  | { type: 'answer'; result: ExerciseResult; at: Date }
  | { type: 'continue' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'presented':
      return { ...state, presenting: false }
    case 'answer':
      return { run: recordAnswer(state.run, action.result, action.at), presenting: false }
    case 'continue': {
      const run = advance(state.run)
      return { run, presenting: currentExercise(run)?.intro ?? false }
    }
  }
}

const init = (exercises: Exercise[]): State => ({
  run: startRun(exercises),
  presenting: exercises[0]?.intro ?? false,
})

type SaveState = { status: 'saving' | 'saved' } | { status: 'failed'; retry: () => void }

interface SessionRunnerProps {
  courseId: CourseId
  mode: SessionMode
  content: CourseIndex
  exercises: Exercise[]
  startedAt: Date
}

export function SessionRunner({
  courseId,
  mode,
  content,
  exercises,
  startedAt,
}: SessionRunnerProps) {
  const [{ run, presenting }, dispatch] = useReducer(reducer, exercises, init)
  const [save, setSave] = useState<SaveState | null>(null)
  const [confirmingQuit, setConfirmingQuit] = useState(false)
  const navigate = useNavigate()
  const exercise = currentExercise(run)
  const answered = isAnswered(run)
  const lastResult = answered ? run.answers[run.position]?.result : undefined

  // Fetch the next exercises' media while the learner works on this one.
  useEffect(() => {
    for (const next of run.queue.slice(run.position, run.position + 3)) {
      const media = next.kind === 'chronology' ? undefined : content.asset(next.mediaId)
      const src = media?.variants?.find((v) => v.width >= 960)?.src ?? media?.src
      if (src) preloadMedia(mediaUrl(src))
    }
  }, [run.position, run.queue, content])

  function persist(finished: SessionRun) {
    setSave({ status: 'saving' })
    saveSession({ courseId, mode, run: finished, startedAt, finishedAt: new Date() })
      .then(() => setSave({ status: 'saved' }))
      .catch((error: unknown) => {
        console.error('Saving the session failed', error)
        setSave({ status: 'failed', retry: () => persist(finished) })
      })
  }

  function onContinue() {
    const next = advance(run)
    if (isFinished(next)) persist(next)
    dispatch({ type: 'continue' })
  }

  if (!exercise || isFinished(run)) {
    return (
      <SessionEnd
        mode={mode}
        summary={summarizeRun(run, { lessonCompleted: mode.type === 'lesson' })}
        saving={save?.status === 'saving'}
        onRetrySave={save?.status === 'failed' ? save.retry : undefined}
      />
    )
  }

  const feedback = answered ? feedbackFor(exercise, content) : undefined
  const progress = runProgress(run)

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 px-safe pt-safe pb-3">
        <button
          type="button"
          onClick={() =>
            run.answers.length > 0 ? setConfirmingQuit(true) : navigate('/', { replace: true })
          }
          aria-label="Quitter la session"
          className="-ml-2.5 grid size-11 shrink-0 place-items-center rounded-full text-muted"
        >
          <CloseIcon className="size-6" />
        </button>
        <div
          role="progressbar"
          aria-label="Progression de la session"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="h-2 flex-1 overflow-hidden rounded-full bg-line"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </header>

      <main className="flex flex-1 flex-col overflow-y-auto px-safe pb-5">
        {exercise.retry && !answered && (
          <p className="mb-3 text-xs font-medium tracking-[0.14em] text-gold uppercase">
            Deuxième essai
          </p>
        )}
        {presenting ? (
          <IntroCard
            key={`intro-${exercise.id}`}
            exercise={exercise}
            content={content}
            onContinue={() => dispatch({ type: 'presented' })}
          />
        ) : (
          <ExerciseView
            key={exercise.id}
            exercise={exercise}
            content={content}
            onAnswer={(result) => dispatch({ type: 'answer', result, at: new Date() })}
          />
        )}
      </main>

      {feedback && lastResult && (
        <AnswerFeedback
          correct={lastResult.correct}
          answerLabel={feedback.answerLabel}
          title={feedback.title}
          summary={feedback.summary}
          credit={feedback.credit}
          prefixAnswer={feedback.prefixAnswer}
          onContinue={onContinue}
        />
      )}

      {confirmingQuit && (
        <BottomSheet title="Quitter la session" onClose={() => setConfirmingQuit(false)}>
          <div className="flex flex-col gap-4 pb-2">
            <h2 className="text-2xl">Quitter la session ?</h2>
            <p className="text-muted">Les réponses de cette session ne seront pas enregistrées.</p>
            <button
              type="button"
              onClick={() => setConfirmingQuit(false)}
              className="min-h-13 rounded-xl bg-accent text-lg font-semibold text-accent-ink"
            >
              Continuer la session
            </button>
            <Link
              to="/"
              replace
              className="flex min-h-13 items-center justify-center rounded-xl border border-line font-medium text-danger"
            >
              Quitter
            </Link>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
