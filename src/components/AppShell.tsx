import type { PropsWithChildren } from 'react'
import { Link, NavLink } from 'react-router-dom'
import type { Profile } from '../types/database'

interface AppShellProps extends PropsWithChildren {
  profile: Profile
}

function navigationClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'app-nav-link app-nav-link--active' : 'app-nav-link'
}

export function AppShell({ profile, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link className="wordmark" to="/" aria-label="whomadethis 지도">
          whomadethis
        </Link>
        <nav className="desktop-nav" aria-label="주요 메뉴">
          <NavLink className={navigationClass} to="/" end>
            지도
          </NavLink>
          <NavLink className={navigationClass} to="/my">
            {profile.nickname}
          </NavLink>
        </nav>
      </header>

      <div className="app-content">{children}</div>

      <nav className="mobile-nav" aria-label="주요 메뉴">
        <NavLink className={navigationClass} to="/" end>
          <span aria-hidden="true">⌖</span>
          지도
        </NavLink>
        <NavLink className={navigationClass} to="/my">
          <span aria-hidden="true">○</span>
          MY
        </NavLink>
      </nav>
    </div>
  )
}
