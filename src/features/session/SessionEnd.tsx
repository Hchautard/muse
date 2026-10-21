import { useState } from 'react'
import { Link } from 'react-router'
import type { CourseIndex } from '../../content/course-index'
import { useTodayStats } from '../../db/hooks'
import { localDay } from '../../engine/calendar'
import type { SessionSummary } from '../../engine/run'
import type { SessionMode } from '../../engine/session'
import { isGoalMet } from '../../engine/streak'
import { FlameIcon } from '../../ui/icons'

interface SessionEndProps {
  mode: SessionMode
  summary: SessionSummary
  content: CourseIndex
  /** Works and concepts met for the first time in this session. */
  introducedIds: string[]
  saving: boolean
  /** Set when saving failed. */
  onRetrySave?: () => void
}

function headline(accuracy: number) {
  if (accuracy === 1) return 'Sans faute !'
  if (accuracy >= 0.8) return 'Très bien'
  if (accuracy >= 0.5) return 'Bien joué'
  return 'Il faudra y revenir'
}

/** End of session: XP earned, accuracy, the day's goal and the works added to the collection. */
export function SessionEnd({
  mode,
  summary,
  content,
  introducedIds,
  saving,
  onRetrySave,
}: SessionEndProps) {
  const percent = Math.round(summary.accuracy * 100)
  const bonuses = [
    summary.xp.lesson > 0 && `leçon terminée +${summary.xp.lesson}`,
    summary.xp.flawless > 0 && `sans faute +${summary.xp.flawless}`,
  ].filter(Boolean)
  const introduced = introducedIds.map((id) => content.entity(id)).filter((e) => e !== undefined)
  const works = introduced.filter((e) => e.type === 'work')
  const concepts = introduced.filter((e) => e.type === 'concept')
  const saved = !saving && !onRetrySave

  return (
    <main className="flex min-h-dvh animate-fade-in flex-col gap-8 px-safe pt-safe pb-safe">
      <header className="flex flex-col gap-2 pt-12 text-center">
        <p className="text-xs font-medium tracking-[0.14em] text-gold uppercase">
          {mode.type === 'lesson' ? 'Leçon terminée' : 'Révision terminée'}
        </p>
        <h1 className="text-4xl">{headline(summary.accuracy)}</h1>
      </header>

      <div className="flex flex-col gap-3">
        <dl className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface p-5">
            <dt className="text-sm text-muted">XP gagnés</dt>
            <dd className="font-serif text-4xl text-gold tabular-nums">{summary.xp.total}</dd>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface p-5">
            <dt className="text-sm text-muted">Précision</dt>
            <dd className="font-serif text-4xl tabular-nums">{percent} %</dd>
          </div>
        </dl>
        <p className="text-center text-sm text-muted">
          {summary.correct} bonne{summary.correct > 1 ? 's' : ''} réponse
          {summary.correct > 1 ? 's' : ''} sur {summary.answered}
          {bonuses.length > 0 && ` · ${bonuses.join(' · ')}`}
        </p>
        {saved && <DailyGoalLine />}
      </div>

      {onRetrySave && (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-2xl border border-danger/40 bg-danger-soft p-5"
        >
          <p className="font-medium text-danger">La progression n’a pas pu être enregistrée.</p>
          <button
            type="button"
            onClick={onRetrySave}
            className="min-h-11 rounded-full border border-line bg-surface px-5 font-medium"
          >
            Réessayer
          </button>
        </div>
      )}

      {works.length > 0 && (
        <section aria-labelledby="added-title" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 id="added-title" className="text-xl">
              Ajouté{works.length > 1 ? 's' : ''} à votre collection
            </h2>
            {saved && (
              <Link to="/collection" replace className="text-sm font-medium text-accent">
                Voir
              </Link>
            )}
          </div>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {works.map((work) => {
              const creator = content.related(work.id, 'createdBy')
              return (
                <li key={work.id} className="flex flex-col py-2.5">
                  <span className="font-serif text-lg leading-snug">{work.name}</span>
                  <span className="text-sm text-muted">
                    {[creator?.name, work.year].filter((part) => part !== undefined).join(' · ')}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {concepts.length > 0 && (
        <p className="text-sm text-muted">
          Nouvelle{concepts.length > 1 ? 's' : ''} notion{concepts.length > 1 ? 's' : ''} :{' '}
          {concepts.map((c) => c.name).join(', ')}
        </p>
      )}

      <Link
        to="/"
        replace
        aria-disabled={saving || onRetrySave !== undefined}
        className="mt-auto flex min-h-13 shrink-0 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-ink transition-[transform,opacity] active:scale-[0.98] aria-disabled:pointer-events-none aria-disabled:opacity-40"
      >
        {saving ? 'Enregistrement…' : 'Continuer'}
      </Link>
    </main>
  )
}

/** Where the day's goal stands now that the session is saved, with the streak. */
function DailyGoalLine() {
  const [today] = useState(() => localDay(new Date()))
  const stats = useTodayStats(today)
  if (!stats) return null
  const sessions = stats.today?.sessions ?? 0
  const left = Math.max(0, stats.goal - sessions)

  return (
    <p className="flex items-center justify-center gap-2 text-center text-sm font-medium">
      {isGoalMet(stats.today) ? (
        <>
          <FlameIcon className="size-4 text-gold" />
          Objectif du jour atteint · série de {stats.streak} jour{stats.streak > 1 ? 's' : ''}
        </>
      ) : (
        <span className="text-muted">
          Encore {left} session{left > 1 ? 's' : ''} pour l’objectif du jour
        </span>
      )}
    </p>
  )
}
