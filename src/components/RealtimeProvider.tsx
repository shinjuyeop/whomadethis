import { useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import {
  RealtimeContext,
  type RealtimeConnectionStatus,
  type SharedRealtimeTable,
} from '../lib/realtimeContext'
import { getSupabaseClient } from '../lib/supabase'

interface RealtimeProviderProps extends PropsWithChildren {
  userId: string
}

interface InvalidationState {
  revision: number
  changedTables: SharedRealtimeTable[]
}

const INVALIDATION_DELAY_MS = 120

export function RealtimeProvider({
  children,
  userId,
}: RealtimeProviderProps) {
  const [invalidation, setInvalidation] = useState<InvalidationState>({
    revision: 0,
    changedTables: [],
  })
  const [connectionStatus, setConnectionStatus] =
    useState<RealtimeConnectionStatus>('connecting')
  useEffect(() => {
    let active = true
    let timeoutId: number | null = null
    const pendingTables = new Set<SharedRealtimeTable>()
    const supabase = getSupabaseClient()

    function queueInvalidation(table: SharedRealtimeTable) {
      if (!active) return
      pendingTables.add(table)
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(() => {
        if (!active) return
        const changedTables = [...pendingTables]
        pendingTables.clear()
        timeoutId = null
        setInvalidation((current) => ({
          revision: current.revision + 1,
          changedTables,
        }))
      }, INVALIDATION_DELAY_MS)
    }

    const channel = supabase
      .channel(`shared-app-data-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurants' },
        () => queueInvalidation('restaurants'),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reviews' },
        () => queueInvalidation('reviews'),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'review_photos' },
        () => queueInvalidation('review_photos'),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => queueInvalidation('profiles'),
      )
      .subscribe((status) => {
        if (!active) return
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
          queueInvalidation('restaurants')
          queueInvalidation('reviews')
          queueInvalidation('review_photos')
          queueInvalidation('profiles')
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          setConnectionStatus('degraded')
        }
      })

    return () => {
      active = false
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
        timeoutId = null
      }
      pendingTables.clear()
      void supabase.removeChannel(channel)
    }
  }, [userId])

  const value = useMemo(
    () => ({
      revision: invalidation.revision,
      changedTables: invalidation.changedTables,
      connectionStatus,
    }),
    [connectionStatus, invalidation],
  )

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  )
}
