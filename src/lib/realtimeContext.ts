import { createContext } from 'react'

export type SharedRealtimeTable =
  | 'restaurants'
  | 'reviews'
  | 'review_photos'
  | 'profiles'

export type RealtimeConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'degraded'

export interface RealtimeContextValue {
  revision: number
  changedTables: readonly SharedRealtimeTable[]
  connectionStatus: RealtimeConnectionStatus
}

export const RealtimeContext = createContext<RealtimeContextValue | null>(null)
