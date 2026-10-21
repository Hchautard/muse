import { Outlet, useMatch } from 'react-router'
import { TabBar } from './TabBar'
import { UpdateBanner } from './UpdateBanner'

export function AppLayout() {
  const inSession = useMatch('/session/*') !== null

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <UpdateBanner />
      <Outlet />
      {!inSession && <TabBar />}
    </div>
  )
}
