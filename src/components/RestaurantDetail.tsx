import { useCallback, useEffect, useState } from 'react'
import { deleteReview, loadRestaurantReviews } from '../lib/reviews'
import type { Restaurant, Review } from '../types/database'
import { useRealtime } from '../hooks/useRealtime'
import { AppIcon } from './AppIcon'
import { PhotoViewer } from './PhotoViewer'

interface RestaurantDetailProps {
  restaurant: Restaurant
  currentUserId: string
  refreshKey: number
  notice: string
  onClearNotice: () => void
  onClose: () => void
  onAddReview: () => void
  onEditReview: (review: Review) => void
  onReviewsChanged: () => Promise<void>
  showClose?: boolean
}

type DetailStatus = 'loading' | 'ready' | 'error'

function formatDate(value: string): string {
  const [year, month, day] = value.split('-')
  return `${year}.${month}.${day}`
}

export function RestaurantDetail({
  restaurant,
  currentUserId,
  refreshKey,
  notice,
  onClearNotice,
  onClose,
  onAddReview,
  onEditReview,
  onReviewsChanged,
  showClose = true,
}: RestaurantDetailProps) {
  const { revision } = useRealtime()
  const [reviews, setReviews] = useState<Review[]>([])
  const [status, setStatus] = useState<DetailStatus>('loading')
  const [message, setMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const loadReviews = useCallback(async () => {
    setStatus('loading')
    setMessage('')
    try {
      setReviews(await loadRestaurantReviews(restaurant.id))
      setStatus('ready')
    } catch {
      setMessage('방문 기록을 불러오지 못했습니다.')
      setStatus('error')
    }
  }, [restaurant.id])

  useEffect(() => {
    let active = true
    void loadRestaurantReviews(restaurant.id)
      .then((loadedReviews) => {
        if (!active) return
        setReviews(loadedReviews)
        setStatus('ready')
      })
      .catch(() => {
        if (!active) return
        setMessage('방문 기록을 불러오지 못했습니다.')
        setStatus('error')
      })

    return () => {
      active = false
    }
  }, [refreshKey, reloadKey, restaurant.id, revision])

  async function handleDelete(review: Review) {
    if (!window.confirm('이 방문 기록과 사진을 삭제할까요?')) return

    setDeletingReviewId(review.id)
    setMessage('')
    try {
      await deleteReview(review)
      await onReviewsChanged()
      setStatus('loading')
      setReloadKey((key) => key + 1)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '방문 기록을 삭제하지 못했습니다.',
      )
    } finally {
      setDeletingReviewId(null)
    }
  }

  const ratingSummary =
    restaurant.reviewCount > 0 && restaurant.averageRating !== null
      ? `★ ${restaurant.averageRating.toFixed(1)} · 리뷰 ${restaurant.reviewCount}개`
      : '아직 평점이 없어요'
  const currentUserReview = reviews.find(
    (review) => review.userId === currentUserId,
  )
  const photoEntries = reviews.flatMap((review) =>
    review.photos.flatMap((photo, index) =>
      photo.signedUrl
        ? [
            {
              id: photo.id,
              url: photo.signedUrl,
              alt: `${review.authorNickname}의 방문 사진 ${index + 1}`,
            },
          ]
        : [],
    ),
  )
  const viewerPhotos = photoEntries.map(({ url, alt }) => ({ url, alt }))

  return (
    <section className="restaurant-detail" aria-labelledby="restaurant-detail-title">
      <header className="restaurant-detail-header">
        <div>
          <p>{restaurant.category || '음식점'}</p>
          <h2 id="restaurant-detail-title">{restaurant.name}</h2>
          <address>
            {restaurant.roadAddress || restaurant.address || '주소 정보 없음'}
          </address>
        </div>
        {showClose && (
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="음식점 상세 닫기"
          >
            <AppIcon name="x" />
          </button>
        )}
      </header>

      <div className="restaurant-rating-summary">{ratingSummary}</div>

      {notice && (
        <div className="detail-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={onClearNotice} aria-label="알림 닫기">
            <AppIcon name="x" />
          </button>
        </div>
      )}

      {photoEntries.length > 0 && (
        <div
          className={`restaurant-photo-strip restaurant-photo-strip--${Math.min(photoEntries.length, 5)}`}
          aria-label="음식점 방문 사진"
        >
          {photoEntries.slice(0, 5).map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setViewerIndex(index)}
              aria-label={`${photo.alt} 크게 보기`}
            >
              <img src={photo.url} alt={photo.alt} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className="detail-add-review"
        onClick={() =>
          currentUserReview ? onEditReview(currentUserReview) : onAddReview()
        }
        disabled={status !== 'ready'}
      >
        {status === 'loading'
          ? '후기 확인 중…'
          : currentUserReview
            ? '후기 수정하기'
            : '후기 남기기'}
      </button>

      <div className="review-list-section">
        <h3>친구들의 후기</h3>
        {status === 'loading' && <p className="detail-state">불러오는 중…</p>}
        {status === 'error' && (
          <div className="inline-error detail-state" role="alert">
            <p>{message}</p>
            <button type="button" onClick={() => void loadReviews()}>
              다시 시도
            </button>
          </div>
        )}
        {status === 'ready' && reviews.length === 0 && (
          <p className="detail-state">아직 이곳에 후기가 없어요. 첫 후기를 남겨보세요.</p>
        )}
        {status === 'ready' && reviews.length > 0 && (
          <ul className="review-list">
            {reviews.map((review) => {
              const isOwner = review.userId === currentUserId
              return (
                <li key={review.id} className="review-item">
                  <div className="review-item-heading">
                    <div>
                      <strong>{review.authorNickname}</strong>
                      <span>★ {review.rating.toFixed(1)}</span>
                    </div>
                    {isOwner && (
                      <div className="review-owner-actions">
                        <button type="button" onClick={() => onEditReview(review)}>
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(review)}
                          disabled={deletingReviewId !== null}
                        >
                          {deletingReviewId === review.id ? '삭제 중…' : '삭제'}
                        </button>
                      </div>
                    )}
                  </div>
                  <time dateTime={review.visitedAt}>
                    {formatDate(review.visitedAt)}
                  </time>
                  {review.content && <p>{review.content}</p>}
                  {review.photos.length > 0 && (
                    <div className="review-photo-grid">
                      {review.photos.map((photo, index) =>
                        photo.signedUrl ? (
                          <button
                            key={photo.id}
                            type="button"
                            onClick={() => {
                              const index = photoEntries.findIndex(
                                (entry) => entry.id === photo.id,
                              )
                              if (index >= 0) setViewerIndex(index)
                            }}
                            aria-label={`${review.authorNickname}의 방문 사진 ${index + 1} 크게 보기`}
                          >
                            <img
                              src={photo.signedUrl}
                              alt={`${review.authorNickname}의 방문 사진 ${index + 1}`}
                              loading="lazy"
                            />
                          </button>
                        ) : (
                          <span key={photo.id} className="photo-placeholder">
                            사진을 불러올 수 없어요
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {viewerIndex !== null && (
        <PhotoViewer
          photos={viewerPhotos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </section>
  )
}
