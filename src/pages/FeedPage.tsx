import { Link } from 'react-router-dom'
import { ActivityReviewItem } from '../components/ActivityReviewItem'
import { useFeedReviews } from '../hooks/useFeedReviews'

export function FeedPage() {
  const {
    items,
    status,
    errorMessage,
    hasMore,
    isLoadingMore,
    reload,
    loadMore,
  } = useFeedReviews()

  return (
    <main className="content-page feed-page">
      <div className="content-column">
        <header className="page-heading">
          <p>친구들의 최근 방문</p>
          <h1>피드</h1>
        </header>

        <div aria-live="polite">
          {status === 'loading' && <div className="content-loading">최근 기록을 불러오는 중…</div>}
          {status === 'error' && items.length === 0 && (
            <div className="content-error" role="alert">
              <p>{errorMessage} 잠시 후 다시 시도해 주세요.</p>
              <button type="button" onClick={() => void reload()}>다시 시도</button>
            </div>
          )}
          {status === 'ready' && items.length === 0 && (
            <div className="empty-state">
              <strong>아직 방문 기록이 없어요.</strong>
              <p>지도에서 첫 기록을 남겨보세요.</p>
              <Link to="/">지도 보기</Link>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="activity-list">
            {items.map((review) => <ActivityReviewItem key={review.id} review={review} />)}
          </div>
        )}

        {errorMessage && items.length > 0 && <p className="load-more-error" role="alert">{errorMessage}</p>}
        {hasMore && (
          <button
            className="load-more-button"
            type="button"
            disabled={isLoadingMore}
            onClick={() => void loadMore()}
          >
            {isLoadingMore ? '불러오는 중…' : '더 보기'}
          </button>
        )}
      </div>
    </main>
  )
}
