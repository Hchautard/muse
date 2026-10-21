import { licenseLabel } from '../../schemas/licenses'
import { CheckIcon, CrossIcon } from '../../ui/icons'
import type { Feedback } from '../session/feedback'

interface AnswerFeedbackProps {
  correct: boolean
  feedback: Feedback
  /** A line under the verdict, e.g. the number of wrong pairings. */
  note?: string
  onContinue: () => void
}

/** Bottom sheet shown after every answer: verdict, correct answer, context and media credits. */
export function AnswerFeedback({ correct, feedback, note, onContinue }: AnswerFeedbackProps) {
  const { answerLabel, title, summary, credits, prefixAnswer, pairs } = feedback

  return (
    <section
      aria-live="polite"
      data-correct={correct}
      className="animate-sheet-up border-t border-danger/30 bg-danger-soft px-safe pt-5 pb-safe data-[correct=true]:border-success/30 data-[correct=true]:bg-success-soft"
    >
      <div className="mx-auto flex max-h-[55dvh] max-w-xl flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <p
            data-correct={correct}
            className="flex items-center gap-2 font-serif text-xl text-danger data-[correct=true]:text-success"
          >
            {correct ? <CheckIcon className="size-6" /> : <CrossIcon className="size-6" />}
            {correct ? 'Exact' : 'Pas tout à fait'}
          </p>
          {note && <p className="text-sm text-muted">{note}</p>}
        </div>

        <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto overscroll-contain">
          {pairs ? (
            <ol className="flex flex-col gap-1">
              {pairs.map((pair, index) => (
                <li key={index} className="flex gap-2 text-[15px] leading-snug">
                  <span className="text-muted tabular-nums">{index + 1}.</span>
                  <span>
                    <strong className="font-semibold">{pair.answer}</strong>
                    <span className="text-muted"> — </span>
                    <em className="font-serif">{pair.title}</em>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <>
              <p>
                {!correct && prefixAnswer && <span className="text-muted">Bonne réponse : </span>}
                <strong className="font-semibold">{answerLabel}</strong>
                <span className="text-muted"> — </span>
                <em className="font-serif">{title}</em>
              </p>
              <p className="text-[15px] leading-relaxed">{summary}</p>
            </>
          )}
          {credits.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {credits.map((credit, index) => (
                <li key={credit.id} className="text-xs text-muted">
                  {credits.length > 1 && `${index + 1}. `}
                  {credit.credit} · {licenseLabel(credit.license)} ·{' '}
                  <a href={credit.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                    source
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={onContinue}
          autoFocus
          data-correct={correct}
          className="mt-1 min-h-13 w-full shrink-0 rounded-xl bg-danger text-lg font-semibold text-paper transition-transform active:scale-[0.98] data-[correct=true]:bg-success"
        >
          Continuer
        </button>
      </div>
    </section>
  )
}
