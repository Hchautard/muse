import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'

interface BottomSheetProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/** Modal sheet anchored to the bottom of the screen, within thumb reach. */
export function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
      previous?.focus()
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-40 flex animate-fade-in items-end justify-center">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[85dvh] w-full max-w-xl animate-sheet-up flex-col rounded-t-3xl border-t border-line bg-paper"
      >
        <div className="flex justify-end px-safe pt-3">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="grid size-11 place-items-center rounded-full text-muted"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-safe pb-safe">{children}</div>
      </section>
    </div>,
    document.body,
  )
}
