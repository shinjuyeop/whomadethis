import { useCallback, useState } from 'react'
import { NaverMap } from '../components/NaverMap'
import { RestaurantPreview } from '../components/RestaurantPreview'
import { RestaurantSearch } from '../components/RestaurantSearch'
import { useRestaurants } from '../hooks/useRestaurants'
import type { Restaurant } from '../types/database'
import type { RestaurantSearchResult } from '../types/naverSearch'

export function HomePage() {
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<Restaurant | null>(null)
  const {
    restaurants,
    status,
    errorMessage,
    refresh,
    selectSearchResult,
  } = useRestaurants()

  const handleMarkerSelect = useCallback((restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant)
  }, [])

  async function handleSearchSelect(result: RestaurantSearchResult) {
    const restaurant = await selectSearchResult(result)
    setSelectedRestaurant(restaurant)
  }

  return (
    <main className="map-page">
      <div className="map-layout">
        <aside className="map-sidebar" aria-label="음식점 검색과 선택 정보">
          <RestaurantSearch onSelect={handleSearchSelect} />

          <div className="restaurant-load-status" aria-live="polite">
            {status === 'loading' && <p>저장된 장소를 불러오는 중…</p>}
            {status === 'error' && (
              <div className="inline-error" role="alert">
                <p>{errorMessage}</p>
                <button type="button" onClick={() => void refresh()}>
                  다시 시도
                </button>
              </div>
            )}
            {status === 'success' && restaurants.length === 0 && (
              <p>첫 장소를 검색해 지도에 표시해 보세요.</p>
            )}
            {status === 'success' && restaurants.length > 0 && (
              <p>함께 저장한 장소 {restaurants.length}곳</p>
            )}
          </div>

          {selectedRestaurant && (
            <RestaurantPreview
              restaurant={selectedRestaurant}
              onClose={() => setSelectedRestaurant(null)}
            />
          )}
        </aside>

        <section className="map-canvas" aria-label="친구들의 맛집 지도">
          <NaverMap
            restaurants={restaurants}
            selectedRestaurant={selectedRestaurant}
            onSelectRestaurant={handleMarkerSelect}
          />
        </section>
      </div>
    </main>
  )
}
