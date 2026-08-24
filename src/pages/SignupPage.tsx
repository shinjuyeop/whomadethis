import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { FullScreenState } from '../components/FullScreenState'
import { useAuth } from '../hooks/useAuth'
import { AuthActionError, signUpWithEmail } from '../lib/auth'

export function SignupPage() {
  const { user, isLoading, errorMessage: authError } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [nickname, setNickname] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isLoading) {
    return <FullScreenState title="로그인 상태를 확인하고 있어요" />
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedNickname = nickname.trim()

    if (trimmedNickname.length < 2 || trimmedNickname.length > 40) {
      setMessage('닉네임은 2자 이상 40자 이하로 입력해 주세요.')
      return
    }

    if (password !== passwordConfirmation) {
      setMessage('비밀번호가 일치하지 않습니다.')
      return
    }

    setIsSubmitting(true)
    setMessage('')

    try {
      await signUpWithEmail(email.trim(), password, trimmedNickname)
      navigate('/', { replace: true })
    } catch (error) {
      setMessage(
        error instanceof AuthActionError
          ? error.message
          : '회원가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="signup-title">
        <Link className="auth-wordmark" to="/">
          whomadethis
        </Link>
        <h1 id="signup-title">회원가입</h1>
        <p>계정을 만들면 바로 맛집 지도를 함께 사용할 수 있어요.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="signup-nickname">닉네임</label>
          <input
            id="signup-nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            autoComplete="nickname"
            minLength={2}
            maxLength={40}
            required
          />

          <label htmlFor="signup-email">이메일</label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="signup-password">비밀번호</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
          <small className="field-hint">6자 이상 입력해 주세요.</small>

          <label htmlFor="signup-password-confirmation">비밀번호 확인</label>
          <input
            id="signup-password-confirmation"
            type="password"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />

          {(message || authError) && (
            <p className="form-message form-message--error" role="alert">
              {message || authError}
            </p>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? '가입 중…' : '회원가입'}
          </button>
        </form>

        <p className="auth-switch">
          이미 계정이 있나요? <Link to="/login">로그인</Link>
        </p>
      </section>
    </main>
  )
}
