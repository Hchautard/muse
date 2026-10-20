import { createBrowserRouter } from 'react-router'
import { CoursePage } from '../features/course/CoursePage'
import { HomePage } from '../features/home/HomePage'
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
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename },
)
