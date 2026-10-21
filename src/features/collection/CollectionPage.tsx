import { use, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AsyncBoundary } from '../../app/AsyncBoundary'
import type { CourseIndex } from '../../content/course-index'
import { loadContentIndex, loadCourse, mediaUrl } from '../../content/loader'
import { useCourseCards } from '../../db/hooks'
import { collectedWorks, collectionGroups, type CollectedWork } from '../../engine/collection'
import type { CourseId } from '../../schemas/content'
import { SegmentedControl } from '../../ui/SegmentedControl'
import { MasteryBar } from './MasteryBar'
import { WorkSheet } from './WorkSheet'

/** The learner's "personal museum": every work met so far. */
export function CollectionPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-safe pt-safe pb-6">
      <h1 className="pt-2 text-[2rem] leading-none tracking-tight">Collection</h1>
      <AsyncBoundary fallback={<GridSkeleton />}>
        <CollectionContent />
      </AsyncBoundary>
    </main>
  )
}

function CollectionContent() {
  const index = use(loadContentIndex())
  const [courseId, setCourseId] = useState<CourseId | undefined>(index.courses[0]?.id)

  return (
    <>
      {index.courses.length > 1 && (
        <SegmentedControl
          label="Parcours"
          options={index.courses.map((c) => ({ value: c.id, label: c.title }))}
          value={courseId}
          onChange={setCourseId}
        />
      )}
      {courseId && (
        <AsyncBoundary fallback={<GridSkeleton />}>
          <CourseCollection key={courseId} courseId={courseId} />
        </AsyncBoundary>
      )}
    </>
  )
}

function CourseCollection({ courseId }: { courseId: CourseId }) {
  const course = use(loadCourse(courseId))
  const cards = useCourseCards(courseId)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const works = useMemo(() => collectedWorks(course, cards ?? []), [course, cards])
  if (!cards) return <GridSkeleton />

  const total = course.bundle.entities.filter((e) => e.type === 'work').length
  const groups = collectionGroups(works)
  const shown = groupId ? works.filter((w) => w.group?.id === groupId) : works
  const open = works.find((w) => w.work.id === openId)

  if (works.length === 0) return <EmptyCollection />

  return (
    <>
      <p className="-mt-3 text-muted">
        {works.length} œuvre{works.length > 1 ? 's' : ''} sur {total} · {course.bundle.title}
      </p>

      {groups.length > 1 && (
        <div
          role="group"
          aria-label="Filtrer par période"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
        >
          {[{ id: null, name: 'Tout' }, ...groups].map((group) => {
            const count = group.id
              ? works.filter((w) => w.group?.id === group.id).length
              : works.length
            return (
              <button
                key={group.id ?? 'all'}
                type="button"
                aria-pressed={groupId === group.id}
                onClick={() => setGroupId(group.id)}
                className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium whitespace-nowrap text-muted transition-colors aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper"
              >
                {group.name}
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      <ul className="grid grid-cols-2 gap-3">
        {shown.map((item) => (
          <li key={item.work.id}>
            <WorkTile course={course} item={item} onOpen={() => setOpenId(item.work.id)} />
          </li>
        ))}
      </ul>

      {open && <WorkSheet course={course} item={open} onClose={() => setOpenId(null)} />}
    </>
  )
}

interface WorkTileProps {
  course: CourseIndex
  item: CollectedWork
  onOpen: () => void
}

/** A painting with its label below, or for music a label with the composer's portrait. */
function WorkTile({ course, item, onOpen }: WorkTileProps) {
  const { work, creator, mastery } = item
  const image = course.media(work, 'image')
  const portrait = creator && course.media(creator, 'image')
  const thumb = (image ?? portrait)?.variants?.[0] ?? image ?? portrait

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface text-left transition-transform active:scale-[0.98]"
    >
      {image && thumb && (
        <img
          src={mediaUrl(thumb.src)}
          alt=""
          loading="lazy"
          className="aspect-[4/5] w-full bg-line object-cover"
        />
      )}
      <span className="flex flex-1 flex-col gap-2 p-3.5">
        {!image && (
          <span className="flex items-center justify-between">
            {thumb ? (
              <img
                src={mediaUrl(thumb.src)}
                alt=""
                loading="lazy"
                className="size-10 rounded-full bg-line object-cover object-top"
              />
            ) : (
              <span aria-hidden="true" className="size-10 rounded-full border border-line" />
            )}
            {work.year !== undefined && (
              <span className="font-serif text-sm text-muted tabular-nums">{work.year}</span>
            )}
          </span>
        )}
        <span className="font-serif text-[17px] leading-snug">{work.name}</span>
        <span className="mt-auto flex flex-col gap-2">
          <span className="text-sm text-muted">
            {creator?.name}
            {image && work.year !== undefined && ` · ${work.year}`}
          </span>
          <MasteryBar value={mastery} />
        </span>
      </span>
    </button>
  )
}

function EmptyCollection() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-line p-8 text-center">
      <h2 className="text-2xl">Votre musée est encore vide</h2>
      <p className="text-muted">
        Chaque œuvre rencontrée dans une leçon vient s’exposer ici, avec son niveau de maîtrise.
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

function GridSkeleton() {
  return (
    <div aria-hidden="true" className="grid animate-pulse grid-cols-2 gap-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-44 rounded-2xl bg-line" />
      ))}
    </div>
  )
}
