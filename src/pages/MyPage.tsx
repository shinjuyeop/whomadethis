import { useState, type FormEvent } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import type { AuthenticatedOutletContext } from '../components/AuthenticatedApp'
import { useAuth } from '../hooks/useAuth'
import { AuthActionError, signOut } from '../lib/auth'

export function MyPage() {
  const { profile, updateProfile } =
    useOutletContext<AuthenticatedOutletContext>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [nickname, setNickname] = useState(profile.nickname)
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState<'error' | 'success'>('success')
  const [isSaving, setIsSaving] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedNickname = nickname.trim()

    if (trimmedNickname.length < 2 || trimmedNickname.length > 40) {
      setMessage('닉네임은 2자 이상 40자 이하로 입력해 주세요.')
      setMessageKind('error')
      return
    }

    setIsSaving(true)
    setMessage('')
    try {
      await updateProfile(trimmedNickname)
      setMessage('프로필을 저장했어요.')
      setMessageKind('success')
    } catch {
      setMessage('프로필을 저장하지 못했습니다. 다시 시도해 주세요.')
      setMessageKind('error')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true)
    setMessage('')
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (error) {
      setMessage(
        error instanceof AuthActionError
          ? error.message
          : '로그아웃하지 못했습니다. 다시 시도해 주세요.',
      )
      setMessageKind('error')
      setIsSigningOut(false)
    }
  }

  return (
    <main className="my-page">
      <section className="my-section" aria-labelledby="my-title">
        <header>
          <p>MY</p>
          <h1 id="my-title">내 프로필</h1>
        </header>

        <form className="profile-form" onSubmit={handleSubmit}>
          <label htmlFor="my-email">이메일</label>
          <input id="my-email" value={user?.email ?? ''} disabled />

          <label htmlFor="my-nickname">닉네임</label>
          <input
            id="my-nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            minLength={2}
            maxLength={40}
            required
          />

          {message && (
            <p
              className={`form-message form-message--${messageKind}`}
              role={messageKind === 'error' ? 'alert' : 'status'}
            >
              {message}
            </p>
          )}

          <button className="primary-button" type="submit" disabled={isSaving}>
            {isSaving ? '저장 중…' : '변경사항 저장'}
          </button>
        </form>

        <button
          className="secondary-button signout-button"
          type="button"
          disabled={isSigningOut}
          onClick={() => void handleSignOut()}
        >
          {isSigningOut ? '로그아웃 중…' : '로그아웃'}
        </button>
      </section>
    </main>
  )
}
