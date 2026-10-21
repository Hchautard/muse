import { Outlet, useMatch } from 'react-router'
import { TabBar } from './TabBar'
import { UpdateBanner } from './UpdateBanner'

export function AppLayout() {
  // Sessions and the daily challenge take the whole screen.
  const session = useMatch('/session/*')
  const challenge = useMatch('/defi')
  const fullScreen = session !== null || challenge !== null

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <UpdateBanner />
      <Outlet />
      {!fullScreen && <TabBar />}
    </div>
  )
}
