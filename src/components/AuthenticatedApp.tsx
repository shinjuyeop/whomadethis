import { useCallback, useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { loadProfile, saveProfile } from '../lib/profiles'
import type { Profile } from '../types/database'
import { AppShell } from './AppShell'
import { FullScreenState } from './FullScreenState'
import { ProfileSetup } from './ProfileSetup'
import { RealtimeProvider } from './RealtimeProvider'

export interface AuthenticatedOutletContext {
  profile: Profile
  updateProfile: (nickname: string) => Promise<Profile>
}

type ProfileStatus = 'loading' | 'ready' | 'missing' | 'error'

interface ProfileState {
  userId: string | null
  reloadKey: number
  status: ProfileStatus
  profile: Profile | null
}

export function AuthenticatedApp() {
  const { user, isLoading, errorMessage: authError } = useAuth()
  const location = useLocation()
  const [reloadKey, setReloadKey] = useState(0)
  const [profileState, setProfileState] = useState<ProfileState>({
    userId: null,
    reloadKey: 0,
    status: 'loading',
    profile: null,
  })

  useEffect(() => {
    if (!user) {
      return
    }

    let active = true
    const requestedUserId = user.id
    const requestedReloadKey = reloadKey

    void loadProfile(requestedUserId)
      .then((nextProfile) => {
        if (!active) return
        setProfileState({
          userId: requestedUserId,
          reloadKey: requestedReloadKey,
          profile: nextProfile,
          status: nextProfile ? 'ready' : 'missing',
        })
      })
      .catch(() => {
        if (!active) return
        setProfileState({
          userId: requestedUserId,
          reloadKey: requestedReloadKey,
          profile: null,
          status: 'error',
        })
      })

    return () => {
      active = false
    }
  }, [reloadKey, user])

  const updateProfile = useCallback(
    async (nickname: string) => {
      if (!user) {
        throw new Error('로그인이 필요합니다.')
      }
      const nextProfile = await saveProfile(user.id, nickname)
      setProfileState({
        userId: user.id,
        reloadKey,
        profile: nextProfile,
        status: 'ready',
      })
      return nextProfile
    },
    [reloadKey, user],
  )

  const isCurrentProfile =
    Boolean(user) &&
    profileState.userId === user?.id &&
    profileState.reloadKey === reloadKey
  const profileStatus = isCurrentProfile ? profileState.status : 'loading'
  const profile = isCurrentProfile ? profileState.profile : null

  if (isLoading) {
    return <FullScreenState title="로그인 상태를 확인하고 있어요" />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (authError) {
    return (
      <FullScreenState
        title="로그인 상태를 확인하지 못했습니다"
        description={authError}
      />
    )
  }

  if (profileStatus === 'loading') {
    return <FullScreenState title="프로필을 준비하고 있어요" />
  }

  if (profileStatus === 'error') {
    return (
      <FullScreenState
        title="프로필을 불러오지 못했습니다"
        description="잠시 후 다시 시도해 주세요."
        actionLabel="다시 시도"
        onAction={() => setReloadKey((key) => key + 1)}
      />
    )
  }

  if (profileStatus === 'missing' || !profile) {
    const metadataNickname = user.user_metadata.nickname
    return (
      <ProfileSetup
        initialNickname={
          typeof metadataNickname === 'string' ? metadataNickname : ''
        }
        onSave={async (nickname) => {
          await updateProfile(nickname)
        }}
      />
    )
  }

  return (
    <RealtimeProvider userId={profile.id}>
      <AppShell profile={profile}>
        <Outlet context={{ profile, updateProfile }} />
      </AppShell>
    </RealtimeProvider>
  )
}
