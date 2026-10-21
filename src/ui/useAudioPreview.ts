import { useCallback, useEffect, useState } from 'react'
import { getSharedAudio } from './audio'

/** Plays short previews from a list; playback only ever starts from a tap, as iOS requires. */
export function useAudioPreview() {
  const [playingId, setPlayingId] = useState<string | null>(null)

  useEffect(() => {
    const audio = getSharedAudio()
    const onEnded = () => setPlayingId(null)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.pause()
    }
  }, [])

  const toggle = useCallback(
    (id: string, src: string) => {
      const audio = getSharedAudio()
      if (playingId === id) {
        audio.pause()
        setPlayingId(null)
        return
      }
      audio.src = src
      setPlayingId(id)
      audio.play().catch(() => setPlayingId(null))
    },
    [playingId],
  )

  return { playingId, toggle }
}
