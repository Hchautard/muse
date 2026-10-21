import { useState } from 'react'
import type { CourseIndex } from '../../content/course-index'
import { mediaUrl } from '../../content/loader'
import type { CollectedWork } from '../../engine/collection'
import { mastery } from '../../engine/fsrs'
import { licenseLabel } from '../../schemas/licenses'
import { BottomSheet } from '../../ui/BottomSheet'
import { AudioButton } from '../exercises/AudioButton'
import { ZoomableImage } from '../exercises/ZoomableImage'
import { dueLabel, formatDate, SKILL_LABELS } from './copy'
import { MasteryBar } from './MasteryBar'

interface WorkSheetProps {
  course: CourseIndex
  item: CollectedWork
  onClose: () => void
}

/** A work's page in the collection: listen or look again, read, and see how well it is known. */
export function WorkSheet({ course, item, onClose }: WorkSheetProps) {
  const { work, creator, group, cards } = item
  const [now] = useState(() => new Date())
  const audio = course.media(work, 'audio')
  const image = course.media(work, 'image')
  const portrait = creator && course.media(creator, 'image')
  const thumb = portrait?.variants?.[0] ?? portrait
  const credit = audio ?? image

  return (
    <BottomSheet title={work.name} onClose={onClose}>
      <article className="flex flex-col gap-5 pb-2">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-[0.14em] text-gold uppercase">
            {[group?.name, work.year].filter((part) => part !== undefined).join(' · ')}
          </p>
          <h2 className="text-3xl leading-tight">{work.name}</h2>
        </header>

        {creator && (
          <div className="flex items-center gap-3">
            {thumb && (
              <img
                src={mediaUrl(thumb.src)}
                alt=""
                className="size-11 shrink-0 rounded-full bg-line object-cover object-top"
              />
            )}
            <p className="flex flex-col">
              <span className="font-serif text-lg leading-tight">{creator.name}</span>
              {creator.yearStart !== undefined && (
                <span className="text-sm text-muted tabular-nums">
                  {creator.yearStart}–{creator.yearEnd}
                </span>
              )}
            </p>
          </div>
        )}

        {audio && (
          <div className="flex justify-center py-1">
            <AudioButton src={mediaUrl(audio.src)} size="md" />
          </div>
        )}
        {!audio && image && <ZoomableImage image={image} alt={work.name} />}

        <p className="text-[15px] leading-relaxed">{work.summary}</p>

        {(work.collection || credit) && (
          <dl className="flex flex-col gap-1 text-sm">
            {work.collection && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted">Conservé :</dt>
                <dd>{work.collection}</dd>
              </div>
            )}
            {credit && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-muted">{audio ? 'Interprétation :' : 'Image :'}</dt>
                <dd>
                  {credit.credit} · {licenseLabel(credit.license)} ·{' '}
                  <a href={credit.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                    source
                  </a>
                </dd>
              </div>
            )}
          </dl>
        )}

        <section aria-labelledby="mastery-title" className="flex flex-col gap-3">
          <h3 id="mastery-title" className="text-lg">
            Maîtrise
          </h3>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {cards.map((card) => (
              <li key={card.id} className="flex items-center justify-between gap-4 py-3">
                <span className="flex flex-col">
                  <span className="font-medium">{SKILL_LABELS[card.skill]}</span>
                  <span className="text-sm text-muted">{dueLabel(card.fsrs.due, now)}</span>
                </span>
                <MasteryBar value={mastery(card.fsrs)} className="w-20 shrink-0" />
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">Rencontrée le {formatDate(item.firstMetAt)}.</p>
        </section>
      </article>
    </BottomSheet>
  )
}
