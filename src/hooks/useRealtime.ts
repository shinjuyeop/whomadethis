import { useContext } from 'react'
import { RealtimeContext } from '../lib/realtimeContext'

export function useRealtime() {
  const value = useContext(RealtimeContext)
  if (!value) {
    throw new Error('useRealtime은 RealtimeProvider 안에서 사용해야 합니다.')
  }
  return value
}
