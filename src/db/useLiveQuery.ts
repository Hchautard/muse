import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'

/**
 * Subscribes to an IndexedDB query and re-renders whenever the data it read changes (e.g. when a
 * session is saved). Returns undefined until the first result.
 */
export function useLiveQuery<T>(query: () => Promise<T>, key: string): T | undefined {
  const [state, setState] = useState<{ key: string; value: T } | undefined>()

  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (value) => setState({ key, value }),
      error: (error: unknown) => console.error('Progress query failed', error),
    })
    return () => subscription.unsubscribe()
    // The query is identified by `key`: it is re-subscribed only when the key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state?.key === key ? state.value : undefined
}
