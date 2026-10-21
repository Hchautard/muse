import { useEffect, useRef } from 'react'

/**
 * Once answered, scrolls the answers into view above the feedback sheet, after `delayMs` (e.g.
 * while an image shrinks).
 */
export function useRevealOnAnswer<T extends HTMLElement>(answered: boolean, delayMs = 50) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!answered) return
    const timer = setTimeout(
      () => ref.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }),
      delayMs,
    )
    return () => clearTimeout(timer)
  }, [answered, delayMs])

  return ref
}
