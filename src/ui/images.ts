import type { MediaAsset } from '../schemas/content'

/** `sizes` of artworks shown in exercises: 90 % of a phone screen, 32 rem beyond. */
export const ARTWORK_SIZES = '(max-width: 36rem) 90vw, 32rem'

/** The variant a browser picks for ARTWORK_SIZES on this screen, to fetch it ahead of time. */
export function artworkSrc(image: MediaAsset): string {
  const cssWidth = window.innerWidth <= 576 ? 0.9 * window.innerWidth : 512
  const needed = cssWidth * (window.devicePixelRatio || 1)
  const variants = [...(image.variants ?? [])].sort((a, b) => a.width - b.width)
  return (variants.find((v) => v.width >= needed) ?? variants.at(-1))?.src ?? image.src
}
