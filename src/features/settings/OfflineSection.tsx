import { use, useEffect, useRef, useState } from 'react'
import type { CourseIndex } from '../../content/course-index'
import { loadCourses } from '../../content/loader'
import { requestPersistentStorage } from '../../db/db'
import { CheckIcon, DownloadIcon } from '../../ui/icons'
import { useOnline } from '../../ui/useOnline'
import {
  downloadCourse,
  formatBytes,
  freeCourse,
  offlineStatus,
  offlineSupported,
  storageUsage,
  type OfflineStatus,
} from './offline'

/** One block per course, then the space used on the device. */
export function OfflineSection() {
  const courses = use(loadCourses())
  const [usage, setUsage] = useState<number>()
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let current = true
    void storageUsage().then((bytes) => current && setUsage(bytes))
    return () => {
      current = false
    }
  }, [version])

  if (!offlineSupported())
    return <p className="text-muted">Ce navigateur ne permet pas le téléchargement hors ligne.</p>

  return (
    <div className="flex flex-col gap-3">
      {courses.map((course) => (
        <CourseDownload
          key={course.bundle.id}
          course={course}
          onChange={() => setVersion((v) => v + 1)}
        />
      ))}
      {usage !== undefined && (
        <p className="text-sm text-muted">
          Espace utilisé par Muse sur cet appareil : {formatBytes(usage)}
        </p>
      )}
    </div>
  )
}

type Download = { done: number; total: number; controller: AbortController }

function CourseDownload({ course, onChange }: { course: CourseIndex; onChange: () => void }) {
  const [status, setStatus] = useState<OfflineStatus>()
  const [download, setDownload] = useState<Download | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const online = useOnline()
  const running = useRef<AbortController | null>(null)

  useEffect(() => {
    let current = true
    offlineStatus(course)
      .then((s) => current && setStatus(s))
      .catch((e: unknown) => console.error('Reading the offline cache failed', e))
    return () => {
      current = false
    }
  }, [course, version])

  // Leaving the screen stops a download in progress (what is done stays done).
  useEffect(() => () => running.current?.abort(), [])

  function refresh() {
    setVersion((v) => v + 1)
    onChange()
  }

  async function start() {
    const controller = new AbortController()
    running.current = controller
    setError(null)
    setDownload({ done: 0, total: status?.totalBytes ?? 0, controller })
    void requestPersistentStorage()
    try {
      await downloadCourse(
        course,
        (done, total) => setDownload({ done, total, controller }),
        controller.signal,
      )
    } catch (e) {
      if (!controller.signal.aborted) {
        console.error('Offline download failed', e)
        setError('Le téléchargement a échoué. Vérifiez la connexion et réessayez.')
      }
    } finally {
      running.current = null
      setDownload(null)
      refresh()
    }
  }

  async function free() {
    await freeCourse(course)
    refresh()
  }

  const complete = status !== undefined && status.cachedCount === status.fileCount
  const missingBytes = status ? status.totalBytes - status.cachedBytes : 0
  const progress = download && download.total > 0 ? download.done / download.total : 0

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <p className="font-serif text-lg leading-snug">{course.bundle.title}</p>
          <p className="text-sm text-muted">
            {status ? statusLabel(status, complete) : 'Vérification…'}
          </p>
        </div>
        {complete && !download && (
          <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-success">
            <CheckIcon className="size-4" />
            Prêt
          </span>
        )}
      </div>

      {download ? (
        <div className="flex flex-col gap-2">
          <div
            role="progressbar"
            aria-label={`Téléchargement de ${course.bundle.title}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="h-2 overflow-hidden rounded-full bg-line"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted tabular-nums">
              {formatBytes(download.done)} sur {formatBytes(download.total)}
            </span>
            <button
              type="button"
              onClick={() => download.controller.abort()}
              className="min-h-11 px-2 font-medium text-muted"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!complete && (
            <button
              type="button"
              disabled={!online || !status}
              onClick={() => void start()}
              className="flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 font-medium text-accent-ink transition-opacity disabled:opacity-40"
            >
              <DownloadIcon className="size-4" />
              {status && status.cachedBytes > 0 ? 'Télécharger le reste' : 'Télécharger'}
              {status && ` (${formatBytes(missingBytes)})`}
            </button>
          )}
          {status && status.cachedCount > 0 && (
            <button
              type="button"
              onClick={() => void free()}
              className="min-h-11 rounded-full border border-line px-4 font-medium"
            >
              Libérer l’espace
            </button>
          )}
        </div>
      )}

      {!online && !complete && !download && (
        <p className="text-sm text-muted">Connectez-vous à internet pour télécharger.</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function statusLabel(status: OfflineStatus, complete: boolean) {
  const size = formatBytes(status.totalBytes)
  if (complete) return `Disponible hors ligne · ${size}`
  if (status.cachedCount === 0) return `Pas encore téléchargé · ${size}`
  return `${status.cachedCount} fichiers sur ${status.fileCount} hors ligne · ${size}`
}
