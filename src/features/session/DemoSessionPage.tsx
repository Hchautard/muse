import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { createRng, hashSeed, shuffle } from '../../engine/random'
import { CloseIcon } from '../../ui/icons'
import { AnswerFeedback } from '../exercises/AnswerFeedback'
import { ImageChoice } from '../exercises/ImageChoice'
import type { ExerciseResult, ImageChoiceExercise } from '../exercises/types'

// Hard-coded phase 1 exercise; real sessions are built from content by the engine in phase 3.
const demoAsset = (file: string) => `${import.meta.env.BASE_URL}demo/${file}`

const DEMO_EXERCISE: ImageChoiceExercise = {
  id: 'demo-vermeer-pearl-earring',
  kind: 'image-choice',
  prompt: 'Qui a peint ce tableau ?',
  image: {
    src: demoAsset('vermeer-pearl-earring-960.webp'),
    variants: [480, 960, 1600].map((width) => ({
      width,
      src: demoAsset(`vermeer-pearl-earring-${width}.webp`),
    })),
    width: 960,
    height: 1137,
    alt: 'Portrait d’une jeune fille vue de trois quarts, coiffée d’un turban bleu et jaune, une perle à l’oreille, sur un fond sombre.',
    credit: 'Johannes Vermeer, Mauritshuis (La Haye)',
    license: 'Public domain',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:1665_Girl_with_a_Pearl_Earring.jpg',
  },
  options: shuffle(
    [
      { id: 'vermeer', label: 'Johannes Vermeer' },
      { id: 'rembrandt', label: 'Rembrandt' },
      { id: 'hals', label: 'Frans Hals' },
      { id: 'caravaggio', label: 'Le Caravage' },
    ],
    createRng(hashSeed('demo-vermeer-pearl-earring')),
  ),
  answerId: 'vermeer',
  reveal: {
    title: 'La Jeune Fille à la perle',
    summary:
      'Peinte vers 1665 par Johannes Vermeer, maître de l’âge d’or hollandais actif à Delft. Le tableau est conservé au Mauritshuis, à La Haye.',
  },
}

export function DemoSessionPage() {
  const navigate = useNavigate()
  const [result, setResult] = useState<ExerciseResult | null>(null)
  const exercise = DEMO_EXERCISE
  const answer = exercise.options.find((o) => o.id === exercise.answerId)
  const progress = result ? 1 : 0

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 px-safe pt-safe pb-3">
        <Link
          to="/"
          aria-label="Quitter la session"
          className="-ml-2.5 grid size-11 shrink-0 place-items-center rounded-full text-muted"
        >
          <CloseIcon className="size-6" />
        </Link>
        <div
          role="progressbar"
          aria-label="Progression de la session"
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={progress}
          className="h-2 flex-1 overflow-hidden rounded-full bg-line"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </header>

      <main className="flex flex-1 flex-col overflow-y-auto px-safe pb-5">
        <ImageChoice exercise={exercise} onAnswer={setResult} />
      </main>

      {result && answer && (
        <AnswerFeedback
          correct={result.correct}
          answerLabel={answer.label}
          title={exercise.reveal.title}
          summary={exercise.reveal.summary}
          credit={exercise.image}
          onContinue={() => navigate('/')}
        />
      )}
    </div>
  )
}
