import { useCallback, useEffect, useRef } from 'react'

/**
 * Measures the time from display to answer. The answer time is the event's `timeStamp`, on the
 * same clock as performance.now() (which may not be called in a render-time handler).
 */
export function useAnswerTimer(exerciseId: string) {
  const startedAt = useRef(0)

  useEffect(() => {
    startedAt.current = performance.now()
  }, [exerciseId])

  return useCallback(
    (event: { timeStamp: number }) => Math.max(0, Math.round(event.timeStamp - startedAt.current)),
    [],
  )
}
