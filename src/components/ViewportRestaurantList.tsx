import { useEffect } from 'react'
import type { Restaurant } from '../types/database'
import { AppIcon } from './AppIcon'

interface RestaurantRowsProps {
  restaurants: Restaurant[]
  onSelect: (restaurant: Restaurant) => void
}

function RestaurantRows({ restaurants, onSelect }: RestaurantRowsProps) {
  return (
    <ul className="viewport-restaurant-list">
      {restaurants.map((restaurant) => {
        const hasRating =
          restaurant.reviewCount > 0 && restaurant.averageRating !== null
        return (
          <li key={restaurant.id}>
            <button type="button" onClick={() => onSelect(restaurant)}>
              <span className="viewport-restaurant-copy">
                <strong>{restaurant.name}</strong>
                <small>
                  {restaurant.category ||
                    restaurant.roadAddress ||
                    restaurant.address ||
                    '음식점'}
                </small>
                <span>
                  {restaurant.roadAddress ||
                    restaurant.address ||
                    '주소 정보 없음'}
                </span>
              </span>
              <span className="viewport-restaurant-stats">
                {hasRating && <strong>★ {restaurant.averageRating?.toFixed(1)}</strong>}
                <small>후기 {restaurant.reviewCount}</small>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

interface ViewportRestaurantListProps extends RestaurantRowsProps {
  status: 'loading' | 'success' | 'error'
}

export function ViewportRestaurantList({
  restaurants,
  status,
  onSelect,
}: ViewportRestaurantListProps) {
  return (
    <section
      className="viewport-restaurant-section"
      aria-labelledby="viewport-restaurant-title"
    >
      <header>
        <div>
          <p>현재 지도 안에서</p>
          <h2 id="viewport-restaurant-title">
            이 지역의 기록 <span>{restaurants.length}</span>
          </h2>
        </div>
      </header>
      {status === 'loading' ? (
        <p className="viewport-restaurant-state">기록을 불러오는 중…</p>
      ) : restaurants.length === 0 ? (
        <p className="viewport-restaurant-state">
          지도를 움직여 친구들의 기록을 찾아보세요.
        </p>
      ) : (
        <RestaurantRows restaurants={restaurants} onSelect={onSelect} />
      )}
    </section>
  )
}

interface ViewportRestaurantSheetProps extends RestaurantRowsProps {
  onClose: () => void
}

export function ViewportRestaurantSheet({
  restaurants,
  onClose,
  onSelect,
}: ViewportRestaurantSheetProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="viewport-sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="viewport-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewport-sheet-title"
      >
        <span className="viewport-sheet-handle" aria-hidden="true" />
        <header>
          <div>
            <p>현재 지도 안에서</p>
            <h2 id="viewport-sheet-title">이 지역의 기록</h2>
            <span>{restaurants.length}곳</span>
          </div>
          <button
            type="button"
            autoFocus
            aria-label="이 지역의 기록 닫기"
            onClick={onClose}
          >
            <AppIcon name="x" />
          </button>
        </header>
        <RestaurantRows restaurants={restaurants} onSelect={onSelect} />
      </section>
    </div>
  )
}
