import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '../../ui/icons'

interface Point {
  x: number
  y: number
}

interface Transform {
  scale: number
  x: number
  y: number
}

interface Gesture {
  start: Transform
  points: Point[]
  startedAt: number
  moved: boolean
  multiTouch: boolean
}

const IDENTITY: Transform = { scale: 1, x: 0, y: 0 }
const MAX_SCALE = 4
const TAP_SCALE = 2.5
const TAP_SLOP_PX = 8
const TAP_MAX_MS = 350

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

interface ImageLightboxProps {
  src: string
  alt: string
  onClose: () => void
}

/**
 * Full-screen image viewer. Pointer events drive pinch-to-zoom and panning (iOS Safari's own
 * pinch is disabled here via `touch-action: none`); a single tap toggles zoom at the tapped point.
 */
export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<Gesture | null>(null)
  const current = useRef<Transform>(IDENTITY)
  const [transform, setTransform] = useState<Transform>(IDENTITY)
  const [smooth, setSmooth] = useState(false)

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  /** Keeps the zoomed image from being dragged off screen. */
  function bounded(next: Transform): Transform {
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (!rect || next.scale <= 1) return IDENTITY
    const maxX = ((next.scale - 1) * rect.width) / 2
    const maxY = ((next.scale - 1) * rect.height) / 2
    return { scale: next.scale, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) }
  }

  function apply(next: Transform, animate: boolean) {
    current.current = bounded(next)
    setSmooth(animate)
    setTransform(current.current)
  }

  /** Pointer position relative to the centre of the viewer. */
  function toLocal(event: PointerEvent): Point {
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: event.clientX - (rect.left + rect.width / 2),
      y: event.clientY - (rect.top + rect.height / 2),
    }
  }

  function beginGesture(previous: Gesture | null) {
    const points = [...pointers.current.values()]
    gesture.current =
      points.length === 0
        ? null
        : {
            start: current.current,
            points,
            startedAt: previous?.startedAt ?? performance.now(),
            moved: previous?.moved ?? false,
            multiTouch: (previous?.multiTouch ?? false) || points.length > 1,
          }
  }

  function onPointerDown(event: PointerEvent) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, toLocal(event))
    beginGesture(gesture.current)
  }

  function onPointerMove(event: PointerEvent) {
    const g = gesture.current
    if (!g || !pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, toLocal(event))
    const points = [...pointers.current.values()]
    const [a, b] = points
    const [a0, b0] = g.points
    if (!a || !a0) return

    if (b && b0) {
      // Pinch: keep the image point under the fingers' midpoint anchored to it.
      const scale = clamp((g.start.scale * distance(a, b)) / distance(a0, b0), 1, MAX_SCALE)
      const m0 = midpoint(a0, b0)
      const m = midpoint(a, b)
      const anchorX = (m0.x - g.start.x) / g.start.scale
      const anchorY = (m0.y - g.start.y) / g.start.scale
      g.moved = true
      apply({ scale, x: m.x - scale * anchorX, y: m.y - scale * anchorY }, false)
      return
    }

    const dx = a.x - a0.x
    const dy = a.y - a0.y
    if (Math.hypot(dx, dy) > TAP_SLOP_PX) g.moved = true
    if (g.start.scale > 1) apply({ ...g.start, x: g.start.x + dx, y: g.start.y + dy }, false)
  }

  function onPointerUp(event: PointerEvent) {
    const g = gesture.current
    const point = pointers.current.get(event.pointerId)
    pointers.current.delete(event.pointerId)

    const isTap =
      g !== null &&
      point !== undefined &&
      pointers.current.size === 0 &&
      !g.moved &&
      !g.multiTouch &&
      performance.now() - g.startedAt < TAP_MAX_MS

    if (isTap) {
      // Zoom in around the tapped point, or back out.
      const next =
        current.current.scale > 1
          ? IDENTITY
          : { scale: TAP_SCALE, x: point.x * (1 - TAP_SCALE), y: point.y * (1 - TAP_SCALE) }
      apply(next, true)
    } else if (pointers.current.size === 0 && current.current.scale < 1.05) {
      apply(IDENTITY, true)
    }

    beginGesture(pointers.current.size > 0 ? g : null)
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image agrandie"
      className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-black text-white"
    >
      <div className="flex justify-end px-safe pt-safe">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="grid size-11 place-items-center rounded-full bg-white/10"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>

      <div
        ref={surfaceRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative flex-1 touch-none overflow-hidden select-none"
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="h-full w-full object-contain"
          style={{
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
            transition: smooth ? 'transform 220ms ease-out' : 'none',
          }}
        />
      </div>

      <p className="px-safe pt-2 pb-safe text-center text-xs text-white/60">
        Pincez ou touchez l’image pour zoomer
      </p>
    </div>,
    document.body,
  )
}
