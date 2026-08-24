import { useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthContext } from '../lib/authContext'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)
  const [errorMessage, setErrorMessage] = useState<string | null>(
    isSupabaseConfigured ? null : '서비스 연결 설정을 확인해 주세요.',
  )

  useEffect(() => {
    let active = true

    if (!isSupabaseConfigured) {
      return
    }

    const supabase = getSupabaseClient()
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return

        if (error) {
          setErrorMessage('로그인 상태를 확인하지 못했습니다.')
        } else {
          setSession(data.session)
        }
        setIsLoading(false)
      })
      .catch(() => {
        if (!active) return
        setErrorMessage('로그인 상태를 확인하지 못했습니다.')
        setIsLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setErrorMessage(null)
      setIsLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      errorMessage,
    }),
    [errorMessage, isLoading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
