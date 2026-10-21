import type { ComponentType, SVGProps } from 'react'
import { NavLink, useLocation } from 'react-router'
import { ChartIcon, FrameIcon, HomeIcon, SlidersIcon } from '../ui/icons'

interface Tab {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Other paths that belong to the tab. */
  also?: string
}

const TABS: Tab[] = [
  { to: '/', label: 'Accueil', icon: HomeIcon, also: '/parcours' },
  { to: '/collection', label: 'Collection', icon: FrameIcon },
  { to: '/statistiques', label: 'Statistiques', icon: ChartIcon },
  { to: '/reglages', label: 'Réglages', icon: SlidersIcon },
]

/** Main navigation, at the bottom within thumb reach; hidden during sessions. */
export function TabBar() {
  const { pathname } = useLocation()

  return (
    <nav
      aria-label="Navigation principale"
      className="sticky bottom-0 z-30 border-t border-line bg-paper/95 px-safe pb-tab backdrop-blur"
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ to, label, icon: Icon, also }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex min-h-13 flex-col items-center justify-center gap-0.5 pt-1.5 text-[11px] font-medium transition-colors ${
                  isActive || (also && pathname.startsWith(also)) ? 'text-accent' : 'text-muted'
                }`
              }
            >
              <Icon className="size-6" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
