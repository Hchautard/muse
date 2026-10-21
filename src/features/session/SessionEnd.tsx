import { Link } from 'react-router'
import type { SessionSummary } from '../../engine/run'
import type { SessionMode } from '../../engine/session'

interface SessionEndProps {
  mode: SessionMode
  summary: SessionSummary
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

/** End of session: XP earned and accuracy. */
export function SessionEnd({ mode, summary, saving, onRetrySave }: SessionEndProps) {
  const percent = Math.round(summary.accuracy * 100)
  const bonuses = [
    summary.xp.lesson > 0 && `leçon terminée +${summary.xp.lesson}`,
    summary.xp.flawless > 0 && `sans faute +${summary.xp.flawless}`,
  ].filter(Boolean)

  return (
    <main className="flex min-h-dvh animate-fade-in flex-col gap-8 px-safe pt-safe pb-safe">
      <header className="flex flex-col gap-2 pt-16 text-center">
        <p className="text-xs font-medium tracking-[0.14em] text-gold uppercase">
          {mode.type === 'lesson' ? 'Leçon terminée' : 'Révision terminée'}
        </p>
        <h1 className="text-4xl">{headline(summary.accuracy)}</h1>
      </header>

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
      <p className="-mt-4 text-center text-sm text-muted">
        {summary.correct} bonne{summary.correct > 1 ? 's' : ''} réponse
        {summary.correct > 1 ? 's' : ''} sur {summary.answered}
        {bonuses.length > 0 && ` · ${bonuses.join(' · ')}`}
      </p>

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

      <Link
        to="/"
        replace
        aria-disabled={saving || onRetrySave !== undefined}
        className="mt-auto flex min-h-13 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-ink transition-[transform,opacity] active:scale-[0.98] aria-disabled:pointer-events-none aria-disabled:opacity-40"
      >
        {saving ? 'Enregistrement…' : 'Continuer'}
      </Link>
    </main>
  )
}
