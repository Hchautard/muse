import { createBrowserRouter } from 'react-router'
import { ChallengePage } from '../features/challenge/ChallengePage'
import { CollectionPage } from '../features/collection/CollectionPage'
import { CoursePage } from '../features/course/CoursePage'
import { HomePage } from '../features/home/HomePage'
import { LessonSessionPage, ReviewSessionPage } from '../features/session/SessionPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { StatsPage } from '../features/stats/StatsPage'
import { AppLayout } from './AppLayout'
import { NotFoundPage } from './NotFoundPage'

// BASE_URL is "/" locally and "/<repo>/" on GitHub Pages.
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/'

export const router = createBrowserRouter(
  [
    {
      element: <AppLayout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'parcours/:courseId', element: <CoursePage /> },
        { path: 'collection', element: <CollectionPage /> },
        { path: 'statistiques', element: <StatsPage /> },
        { path: 'reglages', element: <SettingsPage /> },
        { path: 'defi', element: <ChallengePage /> },
        { path: 'session/:courseId/lecon/:lessonId', element: <LessonSessionPage /> },
        { path: 'session/:courseId/revision', element: <ReviewSessionPage /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename },
)
