import { useRegisterSW } from 'virtual:pwa-register/react'
import { CloseIcon } from '../ui/icons'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/** Registers the service worker and offers a reload when a new version is waiting. */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      setInterval(() => void registration.update(), UPDATE_CHECK_INTERVAL_MS)
    },
    onRegisterError(error: unknown) {
      console.error('Service worker registration failed', error)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-safe pt-safe"
    >
      <div className="pointer-events-auto flex animate-fade-in items-center gap-1 rounded-full border border-line bg-surface py-1 pr-1 pl-4 text-sm shadow-md">
        <span className="mr-2">Nouvelle version</span>
        <button
          type="button"
          onClick={() => void updateServiceWorker()}
          className="min-h-11 rounded-full bg-accent px-4 font-medium text-accent-ink"
        >
          Recharger
        </button>
        <button
          type="button"
          aria-label="Plus tard"
          onClick={() => setNeedRefresh(false)}
          className="grid size-11 place-items-center rounded-full text-muted"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>
    </div>
  )
}
