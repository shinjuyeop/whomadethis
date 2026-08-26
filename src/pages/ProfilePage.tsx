import { Link, useOutletContext, useParams } from 'react-router-dom'
import { ActivityReviewItem } from '../components/ActivityReviewItem'
import { AppIcon } from '../components/AppIcon'
import type { AuthenticatedOutletContext } from '../components/AuthenticatedApp'
import { usePublicProfile } from '../hooks/usePublicProfile'

export function ProfilePage() {
  const { userId = '' } = useParams()
  const { profile: currentProfile } =
    useOutletContext<AuthenticatedOutletContext>()
  const dashboard = usePublicProfile(userId)
  const isCurrentUser = currentProfile.id === userId
  const stats = [
    ['작성한 후기', dashboard.stats.reviewCount.toLocaleString()],
    ['사진', dashboard.stats.photoCount.toLocaleString()],
    ['평균 별점', dashboard.stats.averageRating?.toFixed(1) ?? '—'],
  ]

  return (
    <main className="content-page public-profile-page">
      <div className="profile-column">
        <Link className="back-link" to="/feed">
          <AppIcon name="arrow" /> 피드
        </Link>

        {dashboard.status === 'loading' && (
          <div className="content-loading">프로필을 불러오는 중…</div>
        )}
        {dashboard.status === 'error' && (
          <div className="content-error" role="alert">
            <p>{dashboard.errorMessage} 잠시 후 다시 시도해 주세요.</p>
          </div>
        )}
        {dashboard.status === 'missing' && (
          <div className="empty-state empty-state--left">
            <strong>프로필을 찾을 수 없어요.</strong>
          </div>
        )}

        {dashboard.status === 'ready' && dashboard.profile && (
          <>
            <header className="public-profile-header">
              {dashboard.profile.avatarUrl ? (
                <img
                  src={dashboard.profile.avatarUrl}
                  alt={`${dashboard.profile.nickname} 프로필 사진`}
                />
              ) : (
                <span className="public-profile-avatar" aria-hidden="true">
                  {dashboard.profile.nickname.slice(0, 1)}
                </span>
              )}
              <div>
                <p>{isCurrentUser ? '내 공개 프로필' : '작성자 프로필'}</p>
                <h1>{dashboard.profile.nickname}</h1>
                <span>후기 {dashboard.stats.reviewCount.toLocaleString()}개</span>
              </div>
            </header>

            {dashboard.stats.reviewCount > 0 && (
              <Link
                className="profile-map-link"
                to={`/?author=${encodeURIComponent(userId)}`}
              >
                <AppIcon name="map" />
                {isCurrentUser ? '내 기록만 지도에서 보기' : '이 사람 기록만 지도에서 보기'}
              </Link>
            )}

            <section
              className="my-stats public-profile-stats"
              aria-label={`${dashboard.profile.nickname} 방문 통계`}
            >
              {stats.map(([label, value]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </section>

            <section
              className="public-profile-history"
              aria-labelledby="public-profile-history-title"
            >
              <div className="section-heading">
                <h2 id="public-profile-history-title">작성한 후기</h2>
              </div>

              {dashboard.items.length === 0 ? (
                <div className="empty-state empty-state--left">
                  <strong>아직 작성한 후기가 없어요.</strong>
                </div>
              ) : (
                <div className="activity-list">
                  {dashboard.items.map((review) => (
                    <ActivityReviewItem
                      key={review.id}
                      review={review}
                      hideAuthor
                    />
                  ))}
                </div>
              )}

              {dashboard.hasMore && (
                <button
                  className="load-more-button"
                  type="button"
                  disabled={dashboard.isLoadingMore}
                  onClick={() => void dashboard.loadMore()}
                >
                  {dashboard.isLoadingMore ? '불러오는 중…' : '더 보기'}
                </button>
              )}
              {dashboard.loadMoreError && (
                <p className="load-more-error" role="alert">
                  {dashboard.loadMoreError}
                </p>
              )}
            </section>

            {isCurrentUser && (
              <Link className="profile-manage-link" to="/my">
                내 프로필 관리
              </Link>
            )}
          </>
        )}
      </div>
    </main>
  )
}
