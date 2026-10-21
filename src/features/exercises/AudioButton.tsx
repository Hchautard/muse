import { useAudioPlayer, type PlayerStatus } from '../../ui/audio'
import { PauseIcon, PlayIcon } from '../../ui/icons'

interface AudioButtonProps {
  src: string
  size?: 'md' | 'lg'
}

const LABELS: Record<PlayerStatus, string> = {
  idle: 'Écouter',
  playing: 'Pause',
  paused: 'Reprendre',
  ended: 'Rejouer',
}

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Round play/pause button with a progress ring; tapping again after the end replays. */
export function AudioButton({ src, size = 'lg' }: AudioButtonProps) {
  const { status, progress, toggle } = useAudioPlayer(src)
  const playing = status === 'playing'

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={`${LABELS[status]} (extrait)`}
        aria-pressed={playing}
        data-size={size}
        className="relative grid size-32 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_14px_30px_-16px_rgb(0_0_0/0.6)] transition-transform active:scale-95 data-[size=md]:size-20"
      >
        <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={3}
          />
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-300 ease-linear"
          />
        </svg>
        {playing ? (
          <PauseIcon className="size-10 data-[size=md]:size-7" data-size={size} />
        ) : (
          <PlayIcon className="ml-1.5 size-10 data-[size=md]:size-7" data-size={size} />
        )}
      </button>
      <p aria-hidden="true" className="text-sm text-muted">
        {LABELS[status]}
      </p>
    </div>
  )
}
