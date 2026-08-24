import type { PropsWithChildren } from 'react'
import { Link, NavLink } from 'react-router-dom'
import type { Profile } from '../types/database'
import { AppIcon } from './AppIcon'

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
          <NavLink className={navigationClass} to="/feed">
            피드
          </NavLink>
          <NavLink className={navigationClass} to="/my" aria-label={`${profile.nickname} MY`}>
            MY
          </NavLink>
        </nav>
      </header>

      <div className="app-content">{children}</div>

      <nav className="mobile-nav" aria-label="주요 메뉴">
        <NavLink className={navigationClass} to="/" end>
          <AppIcon name="map" />
          지도
        </NavLink>
        <NavLink className={navigationClass} to="/feed">
          <AppIcon name="feed" />
          피드
        </NavLink>
        <NavLink className={navigationClass} to="/my">
          <AppIcon name="user" />
          MY
        </NavLink>
      </nav>
    </div>
  )
}
