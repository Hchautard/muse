import { use, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AsyncBoundary } from '../../app/AsyncBoundary'
import type { CourseIndex } from '../../content/course-index'
import { loadCourses, mediaUrl } from '../../content/loader'
import { openChallenge, submitGuess } from '../../db/challenge'
import { useChallengeSummary, useSettings } from '../../db/hooks'
import { localDay } from '../../engine/calendar'
import {
  CHALLENGE_GUESSES,
  challengeStatus,
  challengeXp,
  revealedClues,
  shareText,
  type ChallengeRecord,
} from '../../engine/challenge'
import { licenseLabel } from '../../schemas/licenses'
import { CheckIcon, CloseIcon, CrossIcon, FlameIcon } from '../../ui/icons'
import { playSound } from '../../ui/sounds'
import { formatDay } from '../collection/copy'
import { AudioButton } from '../exercises/AudioButton'
import { CroppedImage } from '../exercises/CroppedImage'

/** Close-up of a painting at each clue: tight, wider, then the whole work. */
const ZOOMS = [4, 2, 1, 1]

const weekdayDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/** The daily challenge: one mystery work, found among six titles with up to four guesses. */
export function ChallengePage() {
  const [now] = useState(() => new Date())

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-safe pt-safe pb-safe">
      <header className="flex items-start gap-3">
        <Link
          to="/"
          aria-label="Retour à l’accueil"
          className="-ml-2.5 grid size-11 shrink-0 place-items-center rounded-full text-muted"
        >
          <CloseIcon className="size-6" />
        </Link>
        <div className="flex flex-col pt-1.5">
          <h1 className="text-3xl leading-tight">Œuvre mystère</h1>
          <p className="text-muted first-letter:uppercase">{weekdayDate.format(now)}</p>
        </div>
      </header>
      <AsyncBoundary fallback={<ChallengeSkeleton />}>
        <TodayChallenge now={now} />
      </AsyncBoundary>
    </main>
  )
}

function TodayChallenge({ now }: { now: Date }) {
  const courses = use(loadCourses())
  const today = localDay(now)
  const summary = useChallengeSummary(today)
  const [opened, setOpened] = useState<'pending' | 'ready' | 'locked'>('pending')

  // Draws the day's mystery on the first visit (it is then stored for the whole day).
  useEffect(() => {
    let current = true
    openChallenge(courses, now)
      .then((record) => current && setOpened(record ? 'ready' : 'locked'))
      .catch((error: unknown) => console.error('Opening the challenge failed', error))
    return () => {
      current = false
    }
  }, [courses, now])

  if (opened === 'locked') return <Locked />
  const record = summary?.today
  const content = record && courses.find((c) => c.bundle.id === record.courseId)
  if (!record || !content || !summary) return <ChallengeSkeleton />
  return <ChallengeGame record={record} content={content} streak={summary.streak} />
}

interface ChallengeGameProps {
  record: ChallengeRecord
  content: CourseIndex
  streak: number
}

function ChallengeGame({ record, content, streak }: ChallengeGameProps) {
  const sound = useSettings()?.sound ?? true
  const work = content.entity(record.workId)
  if (!work) return <p className="text-muted">Le défi du jour n’est plus disponible.</p>

  const status = challengeStatus(record)
  const over = status !== 'playing'
  const clues = revealedClues(record)
  const audio = content.media(work, 'audio')
  const image = content.media(work, 'image')
  const creator = content.related(work.id, 'createdBy')
  const group = content.related(work.id, 'inPeriod') ?? content.related(work.id, 'belongsTo')
  const decade = work.year !== undefined ? Math.floor(work.year / 10) * 10 : undefined
  const left = CHALLENGE_GUESSES - record.guesses.length

  const hints = [
    { label: audio ? 'Écoutez l’extrait' : 'Un détail du tableau', value: undefined },
    { label: group?.type === 'movement' ? 'Mouvement' : 'Période', value: group?.name },
    { label: 'Époque', value: decade !== undefined ? `années ${decade}` : undefined },
    { label: creator && audio ? 'Compositeur' : 'Peintre', value: creator?.name },
  ]

  function onGuess(id: string) {
    if (sound) playSound(id === record.workId ? 'correct' : 'wrong')
    void submitGuess(record.date, id)
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {audio && (
        <div className="flex justify-center py-2">
          <AudioButton src={mediaUrl(audio.src)} size={over ? 'md' : 'lg'} />
        </div>
      )}
      {!audio && image && (
        <div className="flex justify-center">
          <div
            data-over={over}
            className="relative aspect-square w-[min(100%,40dvh)] overflow-hidden bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.06),0_12px_28px_-14px_rgb(0_0_0/0.45)] ring-1 ring-line"
          >
            <CroppedImage
              image={image}
              crop={{ ...record.focus, zoom: over ? 1 : (ZOOMS[clues] ?? 1) }}
            />
          </div>
        </div>
      )}

      <ol className="flex flex-col gap-1.5" aria-label="Indices">
        {hints.map((hint, index) => {
          const shown = index <= clues
          return (
            <li
              key={hint.label}
              data-shown={shown}
              className="flex items-baseline gap-2 text-[15px] data-[shown=false]:text-muted/60"
            >
              <span className="w-5 shrink-0 text-sm text-muted tabular-nums">{index + 1}.</span>
              {shown ? (
                <span>
                  <span className="text-muted">{hint.label}</span>
                  {hint.value && <span className="font-medium"> : {hint.value}</span>}
                </span>
              ) : (
                <span>Indice révélé après une erreur</span>
              )}
            </li>
          )
        })}
      </ol>

      {over ? (
        <Result record={record} content={content} streak={streak} />
      ) : (
        <div className="mt-auto flex flex-col gap-3">
          <p className="text-sm text-muted" aria-live="polite">
            Quelle est cette œuvre ? {left} essai{left > 1 ? 's' : ''} restant{left > 1 ? 's' : ''}.
          </p>
          <ul className="flex flex-col gap-2">
            {record.optionIds.map((id) => {
              const tried = record.guesses.includes(id)
              return (
                <li key={id}>
                  <button
                    type="button"
                    disabled={tried}
                    onClick={() => onGuess(id)}
                    data-state={tried ? 'wrong' : 'idle'}
                    className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2 text-left font-medium transition-[transform,opacity] active:scale-[0.98] data-[state=wrong]:border-danger/40 data-[state=wrong]:bg-danger-soft data-[state=wrong]:text-danger data-[state=wrong]:opacity-70"
                  >
                    <span className="font-serif text-[17px] leading-snug">
                      {content.entity(id)?.name}
                    </span>
                    {tried && <CrossIcon className="size-4 shrink-0" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function Result({ record, content, streak }: ChallengeGameProps) {
  const [shared, setShared] = useState(false)
  const work = content.entity(record.workId)!
  const creator = content.related(work.id, 'createdBy')
  const media = content.media(work, 'audio') ?? content.media(work, 'image')
  const found = challengeStatus(record) === 'found'
  const tries = record.guesses.length

  function share() {
    const text = shareText(record, formatDay(new Date(`${record.date}T12:00:00`)))
    const touch = window.matchMedia('(pointer: coarse)').matches
    if (touch && navigator.share) {
      navigator.share({ text }).catch(() => undefined)
      return
    }
    void navigator.clipboard?.writeText(text).then(() => setShared(true))
  }

  return (
    <section className="flex animate-fade-in flex-col gap-4" aria-live="polite">
      <div
        data-found={found}
        className="flex flex-col gap-1 rounded-2xl border border-danger/30 bg-danger-soft p-5 data-[found=true]:border-success/30 data-[found=true]:bg-success-soft"
      >
        <p
          data-found={found}
          className="flex items-center gap-2 font-serif text-xl text-danger data-[found=true]:text-success"
        >
          {found ? <CheckIcon className="size-6" /> : <CrossIcon className="size-6" />}
          {found
            ? `Trouvée en ${tries} essai${tries > 1 ? 's' : ''} · +${challengeXp(record)} XP`
            : 'Pas trouvée cette fois'}
        </p>
        <p className="mt-1">
          <em className="font-serif text-lg">{work.name}</em>
          <span className="text-muted">
            {' — '}
            {[creator?.name, work.year].filter((part) => part !== undefined).join(', ')}
          </span>
        </p>
        <p className="text-[15px] leading-relaxed">{work.summary}</p>
        {media && (
          <p className="text-xs text-muted">
            {media.credit} · {licenseLabel(media.license)}
          </p>
        )}
      </div>

      {streak > 0 && (
        <p className="flex items-center gap-2 text-sm font-medium">
          <FlameIcon className="size-4 text-gold" />
          Série de défis : {streak} jour{streak > 1 ? 's' : ''}
        </p>
      )}
      <p className="text-sm text-muted">Une nouvelle œuvre mystère vous attend demain.</p>

      <div className="mt-auto flex flex-col gap-2.5">
        <button
          type="button"
          onClick={share}
          className="min-h-13 rounded-xl border border-line font-semibold"
        >
          {shared ? 'Résultat copié' : 'Partager le résultat'}
        </button>
        <Link
          to="/"
          className="flex min-h-13 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-accent-ink"
        >
          Terminer
        </Link>
      </div>
    </section>
  )
}

function Locked() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="text-muted">
        Chaque jour, une œuvre déjà rencontrée devient mystère. Terminez une première leçon pour
        débloquer le défi.
      </p>
      <Link
        to="/"
        className="flex min-h-11 items-center rounded-full bg-accent px-5 font-medium text-accent-ink"
      >
        Commencer une leçon
      </Link>
    </div>
  )
}

function ChallengeSkeleton() {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-6">
      <div className="mx-auto size-64 rounded bg-line" />
      <div className="h-24 rounded-xl bg-line" />
      <div className="h-64 rounded-xl bg-line" />
    </div>
  )
}
