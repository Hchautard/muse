import { useState } from 'react'
import { ExpandIcon } from '../../ui/icons'
import { ImageLightbox } from './ImageLightbox'
import type { ExerciseImage } from './types'

interface ZoomableImageProps {
  image: ExerciseImage
  /** Shrinks the artwork, e.g. once answered, so the choices stay visible above the feedback. */
  compact?: boolean
}

/** Framed artwork; tapping it opens a full-screen view with pinch and tap zoom. */
export function ZoomableImage({ image, compact = false }: ZoomableImageProps) {
  const [open, setOpen] = useState(false)
  const srcSet = image.variants.map((v) => `${v.src} ${v.width}w`).join(', ')
  const largestSrc = [...image.variants].sort((a, b) => b.width - a.width)[0]?.src ?? image.src

  return (
    <>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Agrandir l’image"
          className="relative bg-surface p-2 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_12px_28px_-14px_rgb(0_0_0/0.45)] ring-1 ring-line"
        >
          <img
            src={image.src}
            srcSet={srcSet}
            sizes="(max-width: 36rem) 90vw, 32rem"
            width={image.width}
            height={image.height}
            alt={image.alt}
            draggable={false}
            data-compact={compact}
            className="block h-auto max-h-[44dvh] w-auto max-w-full transition-[max-height] duration-300 ease-out select-none data-[compact=true]:max-h-[18dvh]"
          />
          <span className="absolute right-3.5 bottom-3.5 grid size-8 place-items-center rounded-full bg-black/45 text-white">
            <ExpandIcon className="size-4" />
          </span>
        </button>
      </div>

      {open && <ImageLightbox src={largestSrc} alt={image.alt} onClose={() => setOpen(false)} />}
    </>
  )
}
