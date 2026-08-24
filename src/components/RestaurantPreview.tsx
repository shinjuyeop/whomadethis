import { Link } from 'react-router-dom'
import type { Restaurant } from '../types/database'

interface RestaurantPreviewProps {
  restaurant: Restaurant
  onClose: () => void
  onAddReview: () => void
}

export function RestaurantPreview({
  restaurant,
  onClose,
  onAddReview,
}: RestaurantPreviewProps) {
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
          <button type="button" onClick={onAddReview}>나도 기록하기</button>
        </div>
      </div>
    </section>
  )
}
