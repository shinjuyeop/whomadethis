import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loadPublicProfile,
  loadUserReviewPage,
  loadUserReviewStats,
  PUBLIC_PROFILE_PAGE_SIZE,
} from '../lib/publicProfiles'
import type {
  ActivityReview,
  MyReviewStats,
  Profile,
} from '../types/database'
import { useRealtime } from './useRealtime'

type PublicProfileStatus = 'loading' | 'ready' | 'missing' | 'error'

interface PublicProfileState {
  userId: string | null
  profile: Profile | null
  stats: MyReviewStats
  items: ActivityReview[]
  totalCount: number
  status: PublicProfileStatus
  errorMessage: string
}

const EMPTY_STATS: MyReviewStats = {
  visitedRestaurantCount: 0,
  reviewCount: 0,
  photoCount: 0,
  averageRating: null,
}

const INITIAL_STATE: PublicProfileState = {
  userId: null,
  profile: null,
  stats: EMPTY_STATS,
  items: [],
  totalCount: 0,
  status: 'loading',
  errorMessage: '',
}

export function usePublicProfile(userId: string) {
  const { revision } = useRealtime()
  const [state, setState] = useState<PublicProfileState>(INITIAL_STATE)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState('')
  const loadedCountRef = useRef(0)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const requestId = ++requestIdRef.current
    let active = true
    void Promise.all([
      loadPublicProfile(userId),
      loadUserReviewStats(userId),
      loadUserReviewPage(
        userId,
        Math.max(PUBLIC_PROFILE_PAGE_SIZE, loadedCountRef.current),
        0,
      ),
    ])
      .then(([profile, stats, page]) => {
        if (!active || requestId !== requestIdRef.current) return
        loadedCountRef.current = page.items.length
        setState({
          userId,
          profile,
          stats,
          items: page.items,
          totalCount: page.totalCount,
          status: profile ? 'ready' : 'missing',
          errorMessage: '',
        })
        setLoadMoreError('')
      })
      .catch(() => {
        if (!active || requestId !== requestIdRef.current) return
        setState({
          userId,
          profile: null,
          stats: EMPTY_STATS,
          items: [],
          totalCount: 0,
          status: 'error',
          errorMessage: '프로필을 불러오지 못했습니다.',
        })
      })

    return () => {
      active = false
    }
  }, [revision, userId])

  const loadMore = useCallback(async () => {
    if (
      isLoadingMore ||
      state.userId !== userId ||
      loadedCountRef.current >= state.totalCount
    ) {
      return
    }
    setIsLoadingMore(true)
    setLoadMoreError('')
    try {
      const page = await loadUserReviewPage(
        userId,
        PUBLIC_PROFILE_PAGE_SIZE,
        loadedCountRef.current,
      )
      setState((current) => {
        if (current.userId !== userId) return current
        const knownIds = new Set(current.items.map((item) => item.id))
        return {
          ...current,
          items: [
            ...current.items,
            ...page.items.filter((item) => !knownIds.has(item.id)),
          ],
          totalCount:
            page.items.length > 0 ? page.totalCount : current.totalCount,
        }
      })
      loadedCountRef.current += page.items.length
    } catch {
      setLoadMoreError('후기를 더 불러오지 못했습니다.')
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, state.totalCount, state.userId, userId])

  const isCurrentUser = state.userId === userId
  return {
    profile: isCurrentUser ? state.profile : null,
    stats: isCurrentUser ? state.stats : EMPTY_STATS,
    items: isCurrentUser ? state.items : [],
    status: isCurrentUser ? state.status : 'loading',
    errorMessage: isCurrentUser ? state.errorMessage : '',
    hasMore: isCurrentUser && state.items.length < state.totalCount,
    isLoadingMore,
    loadMoreError,
    loadMore,
  }
}
