import { useContext } from 'react'
import { AuthContext } from '../lib/authContext'

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth는 AuthProvider 안에서 사용해야 합니다.')
  }
  return value
}
