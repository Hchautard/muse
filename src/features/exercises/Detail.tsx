import { useState } from 'react'
import { largestSrc } from '../../content/course-index'
import { mediaUrl } from '../../content/loader'
import type { DetailExercise } from '../../engine/exercises'
import { ExpandIcon } from '../../ui/icons'
import { ChoiceList } from './ChoiceList'
import { CroppedImage } from './CroppedImage'
import { CHOICE_PROMPTS, DETAIL_HINT } from './copy'
import { ImageLightbox } from './ImageLightbox'
import type { ExerciseProps } from './types'
import { useAnswerTimer } from './useAnswerTimer'
import { useRevealOnAnswer } from './useRevealOnAnswer'

const REVEAL_MS = 700

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
            <CroppedImage
              image={image}
              crop={answered ? { ...exercise.crop, zoom: 1 } : exercise.crop}
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
