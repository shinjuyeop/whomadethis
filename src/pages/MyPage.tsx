import { useState, type FormEvent } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { ActivityReviewItem } from '../components/ActivityReviewItem'
import type { AuthenticatedOutletContext } from '../components/AuthenticatedApp'
import { ReviewEditor } from '../components/ReviewEditor'
import { useAuth } from '../hooks/useAuth'
import { useMyDashboard } from '../hooks/useMyDashboard'
import { useReviewWorkflow } from '../hooks/useReviewWorkflow'
import { AuthActionError, signOut } from '../lib/auth'

export function MyPage() {
  const { profile, updateProfile } = useOutletContext<AuthenticatedOutletContext>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const dashboard = useMyDashboard()
  const [nickname, setNickname] = useState(profile.nickname)
  const [isEditing, setIsEditing] = useState(false)
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState<'error' | 'success'>('success')
  const [isSaving, setIsSaving] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const workflow = useReviewWorkflow({
    userId: profile.id,
    onSaved: async ({ message: savedMessage }) => {
      await dashboard.reload()
      setMessage(savedMessage)
      setMessageKind('success')
    },
  })

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
      setMessage('닉네임을 수정했습니다.')
      setMessageKind('success')
      setIsEditing(false)
    } catch {
      setMessage('닉네임을 수정하지 못했습니다. 다시 시도해 주세요.')
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

  const stats = [
    ['다녀온 곳', dashboard.stats.visitedRestaurantCount.toLocaleString()],
    ['방문 기록', dashboard.stats.reviewCount.toLocaleString()],
    ['사진', dashboard.stats.photoCount.toLocaleString()],
    ['평균 별점', dashboard.stats.averageRating?.toFixed(1) ?? '—'],
  ]

  return (
    <>
      <main className="content-page my-page">
      <div className="my-column">
        <header className="my-header">
          <div>
            <p>MY</p>
            <h1>{profile.nickname}</h1>
          </div>
          <button type="button" onClick={() => setIsEditing((value) => !value)}>
            {isEditing ? '취소' : '닉네임 수정'}
          </button>
        </header>

        {isEditing && (
          <form className="nickname-form" onSubmit={handleSubmit}>
            <label htmlFor="my-nickname">닉네임</label>
            <div>
              <input
                id="my-nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                minLength={2}
                maxLength={40}
                required
              />
              <button type="submit" disabled={isSaving}>{isSaving ? '저장 중…' : '저장'}</button>
            </div>
          </form>
        )}

        {message && (
          <p className={`form-message form-message--${messageKind}`} role={messageKind === 'error' ? 'alert' : 'status'}>
            {message}
          </p>
        )}

        <section className="my-stats" aria-label="내 방문 통계" aria-busy={dashboard.status === 'loading'}>
          {stats.map(([label, value]) => (
            <div key={label}>
              <strong>{dashboard.status === 'loading' ? '—' : value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </section>

        <section className="my-history" aria-labelledby="my-history-title">
          <div className="section-heading">
            <h2 id="my-history-title">최근 기록</h2>
          </div>
          {dashboard.status === 'loading' && <div className="content-loading">내 기록을 불러오는 중…</div>}
          {dashboard.status === 'error' && dashboard.items.length === 0 && (
            <div className="content-error" role="alert">
              <p>{dashboard.errorMessage} 잠시 후 다시 시도해 주세요.</p>
              <button type="button" onClick={() => void dashboard.reload()}>다시 시도</button>
            </div>
          )}
          {dashboard.status === 'ready' && dashboard.items.length === 0 && (
            <div className="empty-state empty-state--left"><strong>아직 남긴 기록이 없어요.</strong></div>
          )}
          {dashboard.items.length > 0 && (
            <div className="activity-list activity-list--compact">
              {dashboard.items.map((review) => (
                <ActivityReviewItem
                  key={review.id}
                  review={review}
                  compact
                  onEdit={() => workflow.openActivityEdit(review)}
                />
              ))}
            </div>
          )}
          {dashboard.hasMore && (
            <button className="load-more-button" type="button" disabled={dashboard.isLoadingMore} onClick={() => void dashboard.loadMore()}>
              {dashboard.isLoadingMore ? '불러오는 중…' : '더 보기'}
            </button>
          )}
        </section>

        <footer className="my-account">
          <span>{user?.email}</span>
          <button type="button" disabled={isSigningOut} onClick={() => void handleSignOut()}>
            {isSigningOut ? '로그아웃 중…' : '로그아웃'}
          </button>
        </footer>
      </div>
      </main>

      {workflow.editor && (
        <ReviewEditor
          key={workflow.editor.review?.id}
          restaurantName={workflow.editor.target.title}
          restaurantAddress={
            workflow.editor.target.roadAddress || workflow.editor.target.address
          }
          review={workflow.editor.review}
          onAddressSelect={
            workflow.editor.review
              ? () => {
                  const restaurantId = workflow.editor?.review?.restaurantId
                  if (!restaurantId) return
                  workflow.closeEditor()
                  navigate(`/?restaurant=${encodeURIComponent(restaurantId)}`)
                }
              : undefined
          }
          onSubmit={workflow.submit}
          onClose={workflow.closeEditor}
        />
      )}
    </>
  )
}
