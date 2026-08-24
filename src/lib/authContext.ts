import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  isLoading: boolean
  errorMessage: string | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)
