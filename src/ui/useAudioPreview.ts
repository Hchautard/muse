import { useCallback, useEffect, useState } from 'react'

// A single <audio> element shared by every preview: starting an excerpt stops the previous one.
let sharedAudio: HTMLAudioElement | null = null

function getAudio(): HTMLAudioElement {
  sharedAudio ??= Object.assign(new Audio(), { preload: 'none' })
  return sharedAudio
}

/** Plays short previews; playback only ever starts from a tap, as iOS requires. */
export function useAudioPreview() {
  const [playingId, setPlayingId] = useState<string | null>(null)

  useEffect(() => {
    const audio = getAudio()
    const onEnded = () => setPlayingId(null)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.pause()
    }
  }, [])

  const toggle = useCallback(
    (id: string, src: string) => {
      const audio = getAudio()
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
