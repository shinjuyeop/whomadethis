import type { Restaurant } from '../types/database'

interface RestaurantPreviewProps {
  restaurant: Restaurant
  onClose: () => void
}

export function RestaurantPreview({
  restaurant,
  onClose,
}: RestaurantPreviewProps) {
  return (
    <section className="restaurant-preview" aria-labelledby="restaurant-title">
      <button
        type="button"
        className="icon-button restaurant-preview-close"
        onClick={onClose}
        aria-label="선택한 음식점 닫기"
      >
        ×
      </button>
      <p className="restaurant-preview-category">
        {restaurant.category || '음식점'}
      </p>
      <h2 id="restaurant-title">{restaurant.name}</h2>
      <address>
        {restaurant.roadAddress || restaurant.address || '주소 정보 없음'}
      </address>
      <p className="restaurant-preview-note">
        방문 기록과 평점은 다음 단계에서 추가할 수 있어요.
      </p>
    </section>
  )
}
