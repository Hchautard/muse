import { useState, type CSSProperties } from 'react'
import { largestSrc } from '../../content/course-index'
import { mediaUrl } from '../../content/loader'
import type { DetailExercise } from '../../engine/exercises'
import type { MediaAsset } from '../../schemas/content'
import { ExpandIcon } from '../../ui/icons'
import { ChoiceList } from './ChoiceList'
import { CHOICE_PROMPTS, DETAIL_HINT } from './copy'
import { ImageLightbox } from './ImageLightbox'
import type { ExerciseProps } from './types'
import { useAnswerTimer } from './useAnswerTimer'
import { useRevealOnAnswer } from './useRevealOnAnswer'

const REVEAL_MS = 700

/**
 * Where the image sits in the square frame, in % of the frame: zoomed in on the crop point, or
 * whole once answered. The zoomed view is kept within the painting.
 */
function placement(image: MediaAsset, crop: DetailExercise['crop'], whole: boolean): CSSProperties {
  const ratio = image.width && image.height ? image.width / image.height : 1
  // Size of the image when it just covers the frame (or just fits in it, when shown whole).
  const cover = ratio >= 1 ? { w: ratio * 100, h: 100 } : { w: 100, h: 100 / ratio }
  const fit = ratio >= 1 ? { w: 100, h: 100 / ratio } : { w: ratio * 100, h: 100 }
  if (whole)
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

/** Only a close-up of the painting is visible; once answered, it zooms out to the whole work. */
export function Detail({ exercise, content, onAnswer }: ExerciseProps<DetailExercise>) {
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [enlarged, setEnlarged] = useState(false)
  const elapsed = useAnswerTimer(exercise.id)
  const image = content.asset(exercise.mediaId)
  const answered = chosenId !== null
  const choicesRef = useRevealOnAnswer<HTMLDivElement>(answered, REVEAL_MS)

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl">{CHOICE_PROMPTS[exercise.skill]}</h2>
        <p className="text-muted">{DETAIL_HINT}</p>
      </div>

      {image && (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={!answered}
            onClick={() => setEnlarged(true)}
            aria-label={answered ? 'Agrandir le tableau' : 'Détail du tableau à identifier'}
            data-compact={answered}
            className="relative aspect-square w-[min(100%,44dvh)] overflow-hidden bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.06),0_12px_28px_-14px_rgb(0_0_0/0.45)] ring-1 ring-line transition-[width] duration-700 ease-out data-[compact=true]:w-[24dvh]"
          >
            <img
              src={mediaUrl(largestSrc(image))}
              alt=""
              draggable={false}
              className="absolute max-w-none transition-[width,height,left,top] duration-700 ease-out select-none"
              style={placement(image, exercise.crop, answered)}
            />
            {answered && (
              <span className="absolute right-2 bottom-2 grid size-8 place-items-center rounded-full bg-black/45 text-white">
                <ExpandIcon className="size-4" />
              </span>
            )}
          </button>
        </div>
      )}

      <div ref={choicesRef} className="mt-auto">
        <ChoiceList
          options={exercise.optionIds.map((id) => ({ id, label: content.entity(id)?.name ?? id }))}
          answerId={exercise.answerId}
          chosenId={chosenId}
          onChoose={(optionId, event) => {
            setChosenId(optionId)
            onAnswer({
              correct: optionId === exercise.answerId,
              durationMs: elapsed(event),
              chosenId: optionId,
            })
          }}
        />
      </div>

      {enlarged && image && (
        <ImageLightbox
          src={mediaUrl(largestSrc(image))}
          alt={content.entity(exercise.entityId)?.name ?? ''}
          onClose={() => setEnlarged(false)}
        />
      )}
    </div>
  )
}
