import { createBrowserRouter } from 'react-router'
import { HomePage } from '../features/home/HomePage'
import { DemoSessionPage } from '../features/session/DemoSessionPage'
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
        { path: 'session/demo', element: <DemoSessionPage /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename },
)
