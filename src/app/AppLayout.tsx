import { Outlet } from 'react-router'
import { UpdateBanner } from './UpdateBanner'

export function AppLayout() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <UpdateBanner />
      <Outlet />
    </div>
  )
}
