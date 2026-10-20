import type { CourseIndex, LessonRef } from '../../content/course-index'
import { formatDates } from '../../content/course-index'
import { mediaUrl } from '../../content/loader'
import type { LessonState } from '../../engine/progression'
import type { Entity, EntityType, MediaAsset } from '../../schemas/content'
import { licenseLabel } from '../../schemas/licenses'
import { BottomSheet } from '../../ui/BottomSheet'
import { PauseIcon, PlayIcon } from '../../ui/icons'
import { useAudioPreview } from '../../ui/useAudioPreview'

const TYPE_ORDER: EntityType[] = ['period', 'movement', 'person', 'work', 'concept', 'instrument']

const STATE_EYEBROW: Record<LessonState, string> = {
  completed: 'Terminée',
  current: 'En cours',
  locked: 'À venir',
}

interface LessonSheetProps {
  course: CourseIndex
  lessonRef: LessonRef
  state: LessonState
  onClose: () => void
}

/** Preview of what a lesson introduces, with the audio excerpts and portraits it uses. */
export function LessonSheet({ course, lessonRef, state, onClose }: LessonSheetProps) {
  const { lesson, index } = lessonRef
  const { playingId, toggle } = useAudioPreview()
  const entities = lesson.introduces
    .map((id) => course.entity(id))
    .filter((e) => e !== undefined)
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))

  return (
    <BottomSheet title={lesson.title} onClose={onClose}>
      <div className="flex flex-col gap-5 pb-2">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-[0.14em] text-gold uppercase">
            Leçon {index + 1} · {STATE_EYEBROW[state]}
          </p>
          <h2 className="text-2xl">{lesson.title}</h2>
        </header>

        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {entities.map((entity) => (
            <EntityRow
              key={entity.id}
              course={course}
              entity={entity}
              playing={playingId === entity.id}
              onToggle={(audio) => toggle(entity.id, mediaUrl(audio.src))}
            />
          ))}
        </ul>

        <p className="text-sm text-muted">
          Les exercices de cette leçon arrivent avec le moteur de sessions.
        </p>
      </div>
    </BottomSheet>
  )
}

interface EntityRowProps {
  course: CourseIndex
  entity: Entity
  playing: boolean
  onToggle: (audio: MediaAsset) => void
}

function EntityRow({ course, entity, playing, onToggle }: EntityRowProps) {
  const audio = course.media(entity, 'audio')
  const image = course.media(entity, 'image')
  const creator = course.related(entity.id, 'createdBy')
  const dates = formatDates(entity)
  const details = [creator?.name, dates].filter(Boolean).join(' · ')
  const credit = audio ?? image
  const thumb = image?.variants?.[0] ?? image

  return (
    <li className="flex items-center gap-3 py-3">
      {audio ? (
        <button
          type="button"
          onClick={() => onToggle(audio)}
          aria-label={`${playing ? 'Arrêter' : 'Écouter'} l’extrait : ${entity.name}`}
          aria-pressed={playing}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink"
        >
          {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="ml-0.5 size-4" />}
        </button>
      ) : thumb ? (
        <img
          src={mediaUrl(thumb.src)}
          alt=""
          className="size-11 shrink-0 rounded-full bg-line object-cover object-top"
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center rounded-full border border-line font-serif text-gold"
        >
          {entity.name[0]}
        </span>
      )}

      <div className="flex min-w-0 flex-col">
        <p className="font-medium">{entity.name}</p>
        {details && <p className="text-sm text-muted">{details}</p>}
        {credit && (
          <p className="truncate text-xs text-muted/80">
            {credit.credit} · {licenseLabel(credit.license)}
          </p>
        )}
      </div>
    </li>
  )
}
