import { useRef, useState } from 'react'
import {
  backupFileName,
  BackupError,
  parseBackup,
  serializeBackup,
  type Backup,
  type ProgressData,
} from '../../db/backup'
import { useProgressData } from '../../db/hooks'
import { importProgress, resetProgress } from '../../db/progress'
import { localDay } from '../../engine/calendar'
import { BottomSheet } from '../../ui/BottomSheet'
import { formatDate } from '../collection/copy'

type Notice = { tone: 'success' | 'danger'; text: string }

function summary(data: ProgressData) {
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`
  return [
    plural(data.cards.length, 'carte'),
    `${plural(data.lessons.length, 'leçon')} terminée${data.lessons.length > 1 ? 's' : ''}`,
    `${plural(data.daily.length, 'jour')} d’activité`,
  ].join(' · ')
}

/** Hands the file over: the share sheet on a phone ("Enregistrer dans Fichiers"), else a download. */
function deliver(file: File) {
  const touch = window.matchMedia('(pointer: coarse)').matches
  if (touch && navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: 'Progression Muse' }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      download(file)
    })
    return
  }
  download(file)
}

function download(file: File) {
  const url = URL.createObjectURL(file)
  const link = Object.assign(document.createElement('a'), { href: url, download: file.name })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Export, import and reset of the progress. */
export function ProgressSection() {
  // Kept ready: on iOS, sharing a file must happen within the tap, without waiting for IndexedDB.
  const data = useProgressData()
  const [pending, setPending] = useState<Backup | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function exportFile() {
    if (!data) return
    const now = new Date()
    const file = new File([serializeBackup(data, now)], backupFileName(localDay(now)), {
      type: 'application/json',
    })
    deliver(file)
    setNotice(null)
  }

  async function readFile(file: File) {
    try {
      setPending(parseBackup(await file.text()))
      setNotice(null)
    } catch (error) {
      const text = error instanceof BackupError ? error.message : 'Impossible de lire ce fichier.'
      setNotice({ tone: 'danger', text })
    }
  }

  async function confirmImport(backup: Backup) {
    setPending(null)
    try {
      await importProgress(backup)
      setNotice({ tone: 'success', text: 'Progression restaurée.' })
    } catch (error) {
      console.error('Import failed', error)
      setNotice({ tone: 'danger', text: 'L’import a échoué ; rien n’a été modifié.' })
    }
  }

  async function confirmReset() {
    setConfirmingReset(false)
    try {
      await resetProgress()
      setNotice({ tone: 'success', text: 'Progression effacée.' })
    } catch (error) {
      console.error('Reset failed', error)
      setNotice({ tone: 'danger', text: 'La réinitialisation a échoué.' })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <p className="text-sm text-muted">{data ? summary(data) : 'Lecture…'}</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!data}
            onClick={exportFile}
            className="min-h-11 rounded-full bg-accent px-4 font-medium text-accent-ink transition-opacity disabled:opacity-40"
          >
            Exporter
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="min-h-11 rounded-full border border-line px-4 font-medium"
          >
            Importer
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void readFile(file)
          }}
        />
      </div>

      <button
        type="button"
        onClick={() => setConfirmingReset(true)}
        className="min-h-11 self-start px-1 font-medium text-danger"
      >
        Réinitialiser la progression…
      </button>

      {notice && (
        <p
          role="status"
          data-tone={notice.tone}
          className="text-sm font-medium data-[tone=danger]:text-danger data-[tone=success]:text-success"
        >
          {notice.text}
        </p>
      )}

      {pending && (
        <BottomSheet title="Importer une sauvegarde" onClose={() => setPending(null)}>
          <div className="flex flex-col gap-4 pb-2">
            <h2 className="text-2xl">Remplacer votre progression ?</h2>
            <p>
              Sauvegarde du {formatDate(pending.exportedAt)} : {summary(pending)}.
            </p>
            <p className="text-muted">
              Votre progression actuelle sur cet appareil sera remplacée par celle du fichier.
            </p>
            <button
              type="button"
              onClick={() => void confirmImport(pending)}
              className="min-h-13 rounded-xl bg-accent text-lg font-semibold text-accent-ink"
            >
              Remplacer
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="min-h-13 rounded-xl border border-line font-medium"
            >
              Annuler
            </button>
          </div>
        </BottomSheet>
      )}

      {confirmingReset && (
        <BottomSheet title="Réinitialiser la progression" onClose={() => setConfirmingReset(false)}>
          <div className="flex flex-col gap-4 pb-2">
            <h2 className="text-2xl">Tout effacer ?</h2>
            <p>
              Les cartes, les leçons terminées, l’historique et la série seront effacés de cet
              appareil. Vos réglages sont conservés.
            </p>
            <p className="text-muted">
              Exportez d’abord votre progression pour pouvoir la retrouver.
            </p>
            <button
              type="button"
              onClick={() => void confirmReset()}
              className="min-h-13 rounded-xl bg-danger text-lg font-semibold text-paper"
            >
              Tout effacer
            </button>
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="min-h-13 rounded-xl border border-line font-medium"
            >
              Annuler
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
