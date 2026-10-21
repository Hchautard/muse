import { useCallback, useEffect, useRef, useState } from 'react'

// A single <audio> element for the whole app: starting an excerpt stops the previous one, and
// once iOS has let it play after a tap, it keeps that permission.
let sharedAudio: HTMLAudioElement | null = null

interface AudioSessionNavigator {
  audioSession?: { type: string }
}

export function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = Object.assign(new Audio(), { preload: 'auto' })
    // Safari 17+: play as media, like a music app, rather than as a sound effect.
    const session = (navigator as AudioSessionNavigator).audioSession
    if (session) session.type = 'playback'
  }
  return sharedAudio
}

const absolute = (src: string) => new URL(src, document.baseURI).href

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'ended'

/**
 * Play/pause one excerpt on the shared element; playback only ever starts from a tap. Each
 * player starts the excerpt from the beginning, even if another player just played it.
 */
export function useAudioPlayer(src: string) {
  const [status, setStatus] = useState<PlayerStatus>('idle')
  const [progress, setProgress] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    const audio = getSharedAudio()
    const url = absolute(src)
    const mine = () => started.current && audio.src === url
    const onPlaying = () => setStatus((s) => (mine() ? 'playing' : s === 'playing' ? 'paused' : s))
    const onPause = () => setStatus((s) => (s === 'playing' ? 'paused' : s))
    const onEnded = () => {
      if (!mine()) return
      setStatus('ended')
      setProgress(1)
    }
    const onTime = () => {
      if (mine() && audio.duration > 0) setProgress(audio.currentTime / audio.duration)
    }
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('timeupdate', onTime)
    return () => {
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('timeupdate', onTime)
      if (mine()) audio.pause()
      started.current = false
    }
  }, [src])

  const toggle = useCallback(() => {
    const audio = getSharedAudio()
    const url = absolute(src)
    if (started.current && audio.src === url && !audio.paused) {
      audio.pause()
      return
    }
    if (audio.src !== url) audio.src = url
    else if (!started.current || audio.ended) audio.currentTime = 0
    started.current = true
    audio.play().catch(() => setStatus('idle'))
  }, [src])

  return { status, progress, toggle }
}

/** Warms the cache (the service worker's, once installed) for media needed next. */
export function preloadMedia(src: string) {
  fetch(src)
    .then((response) => response.blob())
    .catch(() => undefined)
}
