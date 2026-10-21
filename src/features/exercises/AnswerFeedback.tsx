import { CheckIcon, CrossIcon } from '../../ui/icons'
import { licenseLabel } from '../../schemas/licenses'
import type { MediaCredit } from './types'

interface AnswerFeedbackProps {
  correct: boolean
  answerLabel: string
  title: string
  summary: string
  credit?: MediaCredit
  /** "Bonne réponse :" before the answer after a miss; off when the exercise shows it already. */
  prefixAnswer?: boolean
  onContinue: () => void
}

/** Bottom sheet shown after every answer: verdict, correct answer, context and media credit. */
export function AnswerFeedback({
  correct,
  answerLabel,
  title,
  summary,
  credit,
  prefixAnswer = true,
  onContinue,
}: AnswerFeedbackProps) {
  return (
    <section
      aria-live="polite"
      data-correct={correct}
      className="animate-sheet-up border-t border-danger/30 bg-danger-soft px-safe pt-5 pb-safe data-[correct=true]:border-success/30 data-[correct=true]:bg-success-soft"
    >
      <div className="mx-auto flex max-w-xl flex-col gap-3">
        <p
          data-correct={correct}
          className="flex items-center gap-2 font-serif text-xl text-danger data-[correct=true]:text-success"
        >
          {correct ? <CheckIcon className="size-6" /> : <CrossIcon className="size-6" />}
          {correct ? 'Exact' : 'Pas tout à fait'}
        </p>

        <div className="flex flex-col gap-1.5">
          <p>
            {!correct && prefixAnswer && <span className="text-muted">Bonne réponse : </span>}
            <strong className="font-semibold">{answerLabel}</strong>
            <span className="text-muted"> — </span>
            <em className="font-serif">{title}</em>
          </p>
          <p className="text-[15px] leading-relaxed">{summary}</p>
          {credit && (
            <p className="text-xs text-muted">
              {credit.credit} · {licenseLabel(credit.license)} ·{' '}
              <a href={credit.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                source
              </a>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onContinue}
          autoFocus
          data-correct={correct}
          className="mt-1 min-h-13 w-full rounded-xl bg-danger text-lg font-semibold text-paper transition-transform active:scale-[0.98] data-[correct=true]:bg-success"
        >
          Continuer
        </button>
      </div>
    </section>
  )
}
