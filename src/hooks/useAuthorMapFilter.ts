import { useEffect, useState } from 'react'
import {
  loadPublicProfile,
  loadUserRestaurantIds,
} from '../lib/publicProfiles'
import type { Profile } from '../types/database'
import { useRealtime } from './useRealtime'

type AuthorMapFilterStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error'

interface AuthorMapFilterState {
  authorId: string | null
  profile: Profile | null
  restaurantIds: string[]
  status: AuthorMapFilterStatus
}

const INITIAL_STATE: AuthorMapFilterState = {
  authorId: null,
  profile: null,
  restaurantIds: [],
  status: 'idle',
}

export function useAuthorMapFilter(authorId: string | null) {
  const { revision } = useRealtime()
  const [state, setState] = useState<AuthorMapFilterState>(INITIAL_STATE)

  useEffect(() => {
    if (!authorId) return
    let active = true
    void Promise.all([
      loadPublicProfile(authorId),
      loadUserRestaurantIds(authorId),
    ])
      .then(([profile, restaurantIds]) => {
        if (!active) return
        setState({
          authorId,
          profile,
          restaurantIds,
          status: profile ? 'ready' : 'missing',
        })
      })
      .catch(() => {
        if (!active) return
        setState({
          authorId,
          profile: null,
          restaurantIds: [],
          status: 'error',
        })
      })
    return () => {
      active = false
    }
  }, [authorId, revision])

  if (!authorId) return INITIAL_STATE
  if (state.authorId !== authorId) {
    return { ...INITIAL_STATE, authorId, status: 'loading' as const }
  }
  return state
}
