import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient } from './supabase'

export interface SignUpResult {
  session: Session | null
  requiresEmailConfirmation: boolean
}

export class AuthActionError extends Error {}

function authErrorMessage(code?: string): string {
  switch (code) {
    case 'invalid_credentials':
      return '이메일 또는 비밀번호를 확인해 주세요.'
    case 'email_not_confirmed':
      return '인증 이메일을 확인해 주세요.'
    case 'user_already_exists':
    case 'email_exists':
      return '이미 가입된 이메일입니다. 로그인해 주세요.'
    case 'weak_password':
      return '더 안전한 비밀번호를 입력해 주세요.'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
    default:
      return '인증 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  }
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new AuthActionError(authErrorMessage(error.code))
  }

  return data.session
}

export async function signUpWithEmail(
  email: string,
  password: string,
  nickname: string,
): Promise<SignUpResult> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: {
      data: { nickname },
    },
  })

  if (error) {
    throw new AuthActionError(authErrorMessage(error.code))
  }

  return {
    session: data.session,
    requiresEmailConfirmation: data.session === null,
  }
}

export async function signOut() {
  const { error } = await getSupabaseClient().auth.signOut()
  if (error) {
    throw new AuthActionError(
      '로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    )
  }
}
