import { Link } from 'react-router'
import { useChallengeSummary } from '../../db/hooks'
import { challengeStatus, challengeXp } from '../../engine/challenge'
import { FlameIcon } from '../../ui/icons'

/** Home card of the daily challenge: what is left to do today, and the challenge streak. */
export function ChallengeCard({ today }: { today: string }) {
  const summary = useChallengeSummary(today)
  if (!summary) return <div aria-hidden="true" className="h-24 animate-pulse rounded-2xl bg-line" />

  const record = summary.today
  const status = record ? challengeStatus(record) : 'playing'
  const tries = record?.guesses.length ?? 0
  const line = !summary.unlocked
    ? 'Terminez une première leçon pour la débloquer.'
    : status === 'found'
      ? `Trouvée en ${tries} essai${tries > 1 ? 's' : ''} · +${record ? challengeXp(record) : 0} XP`
      : status === 'missed'
        ? 'Pas trouvée aujourd’hui — revenez demain.'
        : tries > 0
          ? `${tries} essai${tries > 1 ? 's' : ''} sur 4 — à vous de jouer`
          : 'Une œuvre déjà rencontrée, à reconnaître en quatre essais.'

  const body = (
    <>
      <span className="flex flex-col gap-0.5">
        <span className="text-xs font-medium tracking-[0.14em] text-gold uppercase">
          Défi du jour
        </span>
        <span className="font-serif text-xl">Œuvre mystère</span>
        <span className="text-sm text-muted">{line}</span>
      </span>
      {summary.streak > 0 && (
        <span
          className="flex shrink-0 items-center gap-1 text-sm text-muted"
          aria-label={`Série de défis : ${summary.streak} jour${summary.streak > 1 ? 's' : ''}`}
        >
          <FlameIcon className="size-4 text-gold" />
          <span className="tabular-nums">{summary.streak}</span>
        </span>
      )}
    </>
  )

  const className =
    'flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 text-left'
  if (!summary.unlocked) return <div className={`${className} opacity-70`}>{body}</div>
  return (
    <Link to="/defi" className={`${className} transition-transform active:scale-[0.99]`}>
      {body}
    </Link>
  )
}
