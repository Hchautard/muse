// Short sound effects, synthesised with the Web Audio API (no files to download or cache).
// They are played from taps, which is what lets iOS start the audio context.

export type SoundName = 'correct' | 'wrong' | 'complete'

interface Note {
  /** Hz. */
  frequency: number
  /** Seconds after the start. */
  at: number
  duration: number
}

const SOUNDS: Record<SoundName, { wave: OscillatorType; volume: number; notes: Note[] }> = {
  // A rising fourth, soft and short.
  correct: {
    wave: 'sine',
    volume: 0.12,
    notes: [
      { frequency: 659.25, at: 0, duration: 0.12 },
      { frequency: 880, at: 0.09, duration: 0.22 },
    ],
  },
  wrong: {
    wave: 'triangle',
    volume: 0.1,
    notes: [
      { frequency: 220, at: 0, duration: 0.16 },
      { frequency: 196, at: 0.12, duration: 0.26 },
    ],
  },
  // A major arpeggio.
  complete: {
    wave: 'sine',
    volume: 0.11,
    notes: [523.25, 659.25, 783.99, 1046.5].map((frequency, i) => ({
      frequency,
      at: i * 0.11,
      duration: i === 3 ? 0.5 : 0.18,
    })),
  },
}

let context: AudioContext | null = null

export function playSound(name: SoundName) {
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    const { wave, volume, notes } = SOUNDS[name]
    const start = context.currentTime + 0.01
    for (const note of notes) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = wave
      oscillator.frequency.value = note.frequency
      // Quick attack and exponential release, to avoid clicks.
      const from = start + note.at
      gain.gain.setValueAtTime(0.0001, from)
      gain.gain.exponentialRampToValueAtTime(volume, from + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, from + note.duration)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(from)
      oscillator.stop(from + note.duration + 0.02)
    }
  } catch (error) {
    console.warn('Sound effect failed', error)
  }
}
