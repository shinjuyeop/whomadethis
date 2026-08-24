import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadRestaurantReviews } from '../lib/reviews'
import type { Restaurant, Review } from '../types/database'

interface RestaurantPreviewProps {
  restaurant: Restaurant
  currentUserId: string
  onClose: () => void
  onAddReview: () => void
  onEditReview: (review: Review) => void
}

export function RestaurantPreview({
  restaurant,
  currentUserId,
  onClose,
  onAddReview,
  onEditReview,
}: RestaurantPreviewProps) {
  const [currentUserReview, setCurrentUserReview] = useState<Review | null>(null)
  const [reviewStatus, setReviewStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [reviewReloadKey, setReviewReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    void loadRestaurantReviews(restaurant.id)
      .then((reviews) => {
        if (!active) return
        setCurrentUserReview(
          reviews.find((review) => review.userId === currentUserId) ?? null,
        )
        setReviewStatus('ready')
      })
      .catch(() => {
        if (!active) return
        setCurrentUserReview(null)
        setReviewStatus('error')
      })

    return () => {
      active = false
    }
  }, [
    currentUserId,
    restaurant.id,
    restaurant.reviewCount,
    reviewReloadKey,
  ])

  const rating =
    restaurant.reviewCount > 0 && restaurant.averageRating !== null
      ? `★ ${restaurant.averageRating.toFixed(1)} · 리뷰 ${restaurant.reviewCount}개`
      : '아직 방문 기록이 없어요'

  return (
    <section className="restaurant-preview" aria-labelledby="preview-title">
      {restaurant.coverPhotoUrl && (
        <img src={restaurant.coverPhotoUrl} alt={`${restaurant.name} 대표 방문 사진`} />
      )}
      <div className="restaurant-preview-copy">
        <div className="restaurant-preview-heading">
          <div>
            <h2 id="preview-title">{restaurant.name}</h2>
            <p>{rating}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="선택한 음식점 닫기">
            ×
          </button>
        </div>
        <address>
          {restaurant.roadAddress || restaurant.address || '주소 정보 없음'}
        </address>
        <div className="restaurant-preview-actions">
          <Link to={`/restaurants/${restaurant.id}`}>상세보기</Link>
          <button
            type="button"
            onClick={() => {
              if (reviewStatus === 'error') {
                setReviewStatus('loading')
                setReviewReloadKey((key) => key + 1)
                return
              }
              if (currentUserReview) onEditReview(currentUserReview)
              else onAddReview()
            }}
            disabled={reviewStatus === 'loading'}
          >
            {reviewStatus === 'loading'
              ? '후기 확인 중…'
              : reviewStatus === 'error'
                ? '다시 확인'
                : currentUserReview
                  ? '후기 수정하기'
                  : '후기 남기기'}
          </button>
        </div>
      </div>
    </section>
  )
}
