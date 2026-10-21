import type { CSSProperties } from 'react'
import { largestSrc } from '../../content/course-index'
import { mediaUrl } from '../../content/loader'
import type { MediaAsset } from '../../schemas/content'

export interface Crop {
  /** Zoom centre, as fractions of the image's width and height. */
  x: number
  y: number
  /** Magnification; 1 or less shows the whole image. */
  zoom: number
}

/**
 * Where the image sits in its square frame, in % of the frame: zoomed in on the crop point, or
 * whole. The zoomed view is kept within the painting.
 */
function placement(image: MediaAsset, crop: Crop): CSSProperties {
  const ratio = image.width && image.height ? image.width / image.height : 1
  // Size of the image when it just covers the frame (or just fits in it, when shown whole).
  const cover = ratio >= 1 ? { w: ratio * 100, h: 100 } : { w: 100, h: 100 / ratio }
  const fit = ratio >= 1 ? { w: 100, h: 100 / ratio } : { w: ratio * 100, h: 100 }
  if (crop.zoom <= 1)
    return {
      width: `${fit.w}%`,
      height: `${fit.h}%`,
      left: `${(100 - fit.w) / 2}%`,
      top: `${(100 - fit.h) / 2}%`,
    }
  const w = cover.w * crop.zoom
  const h = cover.h * crop.zoom
  const clamp = (value: number, size: number) => Math.min(0, Math.max(100 - size, value))
  return {
    width: `${w}%`,
    height: `${h}%`,
    left: `${clamp(50 - crop.x * w, w)}%`,
    top: `${clamp(50 - crop.y * h, h)}%`,
  }
}

/** The image inside a square, positioned frame; changes of crop are animated. */
export function CroppedImage({ image, crop }: { image: MediaAsset; crop: Crop }) {
  return (
    <img
      src={mediaUrl(largestSrc(image))}
      alt=""
      draggable={false}
      className="absolute max-w-none transition-[width,height,left,top] duration-700 ease-out select-none"
      style={placement(image, crop)}
    />
  )
}
