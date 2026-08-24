import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { FullScreenState } from '../components/FullScreenState'
import { useAuth } from '../hooks/useAuth'
import { AuthActionError, signInWithEmail } from '../lib/auth'

export function LoginPage() {
  const { user, isLoading, errorMessage: authError } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    setIsSubmitting(true)
    setMessage('')

    try {
      await signInWithEmail(email.trim(), password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from.startsWith('/') ? from : '/', { replace: true })
    } catch (error) {
      setMessage(
        error instanceof AuthActionError
          ? error.message
          : '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <Link className="auth-wordmark" to="/">
          whomadethis
        </Link>
        <h1 id="login-title">로그인</h1>
        <p>친구들과 함께 만든 맛집 지도를 열어보세요.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">이메일</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="login-password">비밀번호</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
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
            {isSubmitting ? '로그인 중…' : '로그인'}
          </button>
        </form>

        <p className="auth-switch">
          처음인가요? <Link to="/signup">회원가입</Link>
        </p>
      </section>
    </main>
  )
}
