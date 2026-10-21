import type { CourseIndex } from '../../content/course-index'
import { mediaUrl } from '../../content/loader'
import type { Exercise } from '../../engine/exercises'
import { licenseLabel } from '../../schemas/licenses'
import { AudioButton } from '../exercises/AudioButton'
import { ZoomableImage } from '../exercises/ZoomableImage'

interface IntroCardProps {
  exercise: Exercise
  content: CourseIndex
  onContinue: () => void
}

/** First encounter with a work: who made it, when, and a first listen, before the question. */
export function IntroCard({ exercise, content, onContinue }: IntroCardProps) {
  const work = content.entity(exercise.entityId)
  if (!work) return null
  const creator = content.related(work.id, 'createdBy')
  const portrait = creator && content.media(creator, 'image')
  const thumb = portrait?.variants?.[0] ?? portrait
  const period = content.related(work.id, 'inPeriod') ?? content.related(work.id, 'belongsTo')
  const audio = content.media(work, 'audio')
  const image = content.media(work, 'image')
  const credit = audio ?? image

  return (
    <div className="flex flex-1 animate-fade-in flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-[0.14em] text-gold uppercase">Nouvelle œuvre</p>
        <h2 className="text-3xl leading-tight">{work.name}</h2>
        <p className="text-muted">
          {[work.year, period?.name].filter((part) => part !== undefined).join(' · ')}
        </p>
      </header>

      {creator && (
        <div className="flex items-center gap-3">
          {thumb ? (
            <img
              src={mediaUrl(thumb.src)}
              alt=""
              className="size-12 shrink-0 rounded-full bg-line object-cover object-top"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-12 place-items-center rounded-full border border-line font-serif text-gold"
            >
              {creator.name[0]}
            </span>
          )}
          <p className="font-serif text-xl">{creator.name}</p>
        </div>
      )}

      <div className="flex flex-1 items-center justify-center py-2">
        {audio && <AudioButton src={mediaUrl(audio.src)} />}
        {!audio && image && <ZoomableImage image={image} alt={work.name} />}
      </div>

      {credit && (
        <p className="text-center text-xs text-muted">
          {credit.credit} · {licenseLabel(credit.license)}
        </p>
      )}

      <button
        type="button"
        onClick={onContinue}
        className="min-h-13 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink transition-transform active:scale-[0.98]"
      >
        J’ai compris
      </button>
    </div>
  )
}
