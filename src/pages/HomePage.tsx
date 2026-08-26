import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import type { AuthenticatedOutletContext } from '../components/AuthenticatedApp'
import { AppIcon } from '../components/AppIcon'
import { NaverMap } from '../components/NaverMap'
import { RestaurantDetail } from '../components/RestaurantDetail'
import { RestaurantPreview } from '../components/RestaurantPreview'
import { RestaurantSearch } from '../components/RestaurantSearch'
import { ReviewEditor } from '../components/ReviewEditor'
import {
  ViewportRestaurantList,
  ViewportRestaurantSheet,
} from '../components/ViewportRestaurantList'
import { useMediaQuery } from '../hooks/useMediaQuery'
import {
  restaurantToSearchResult,
  useReviewWorkflow,
} from '../hooks/useReviewWorkflow'
import { useRestaurants } from '../hooks/useRestaurants'
import { isLikelyRoadAddress } from '../lib/addressSearch'
import { normalizeRestaurantIdentity } from '../lib/naverSearch'
import {
  RestaurantSelectionError,
  resolveRestaurantCoordinates,
} from '../lib/restaurants'
import { loadRestaurantReviews } from '../lib/reviews'
import type { Restaurant } from '../types/database'
import type { MapViewport } from '../types/map'
import type {
  LocatedRestaurantSearchResult,
  RestaurantSearchResult,
} from '../types/naverSearch'

export function HomePage() {
  const { profile } = useOutletContext<AuthenticatedOutletContext>()
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const requestedRestaurantId = new URLSearchParams(location.search).get(
    'restaurant',
  )
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(
    requestedRestaurantId,
  )
  const [selectedSearchResult, setSelectedSearchResult] =
    useState<LocatedRestaurantSearchResult | null>(null)
  const searchLocationRequestRef = useRef(0)
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)
  const [searchResetKey, setSearchResetKey] = useState(0)
  const [viewport, setViewport] = useState<MapViewport | null>(null)
  const [visibleRestaurants, setVisibleRestaurants] = useState<Restaurant[]>([])
  const [hasSearchResults, setHasSearchResults] = useState(false)
  const [isViewportSheetOpen, setIsViewportSheetOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const { restaurants, status, errorMessage, refresh } = useRestaurants()
  const selectedRestaurant =
    restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ??
    null
  const workflow = useReviewWorkflow({
    userId: profile.id,
    onSaved: async ({ restaurantId, message }) => {
      let nextMessage = message
      try {
        await refresh()
      } catch {
        nextMessage += ' 지도 정보는 잠시 후 다시 확인해 주세요.'
      }
      setSelectedRestaurantId(restaurantId)
      setSelectedSearchResult(null)
      setDetailRefreshKey((key) => key + 1)
      setNotice(nextMessage)
    },
  })

  const handleMarkerSelect = useCallback((restaurant: Restaurant) => {
    searchLocationRequestRef.current += 1
    setSelectedRestaurantId(restaurant.id)
    setSelectedSearchResult(null)
    setIsViewportSheetOpen(false)
    setNotice('')
  }, [])

  useEffect(() => {
    if (!requestedRestaurantId || status !== 'success') return
    navigate('/', { replace: true })
  }, [navigate, requestedRestaurantId, status])

  const handleMapClick = useCallback(() => {
    searchLocationRequestRef.current += 1
    setSelectedSearchResult(null)
    setSearchResetKey((key) => key + 1)
    setHasSearchResults(false)
  }, [])

  const handleViewportChange = useCallback((nextViewport: MapViewport) => {
    setViewport(nextViewport)
  }, [])

  const handleVisibleRestaurantsChange = useCallback(
    (nextRestaurants: Restaurant[]) => {
      setVisibleRestaurants(nextRestaurants)
      if (nextRestaurants.length === 0) setIsViewportSheetOpen(false)
    },
    [],
  )

  const handleSearchResultsVisibilityChange = useCallback((visible: boolean) => {
    setHasSearchResults(visible)
  }, [])

  const handleClearSearchLocation = useCallback(() => {
    searchLocationRequestRef.current += 1
    setSelectedSearchResult(null)
  }, [])

  async function handleSearchLocate(result: RestaurantSearchResult) {
    const requestId = searchLocationRequestRef.current + 1
    searchLocationRequestRef.current = requestId
    setSelectedRestaurantId(null)
    setSelectedSearchResult(null)
    setIsViewportSheetOpen(false)
    setNotice('')

    try {
      const coordinate = await resolveRestaurantCoordinates(result)
      if (requestId !== searchLocationRequestRef.current) return
      setSelectedSearchResult({ ...result, ...coordinate, kind: 'search' })
    } catch (error) {
      if (requestId !== searchLocationRequestRef.current) return
      throw error instanceof RestaurantSelectionError
        ? error
        : new RestaurantSelectionError(
            '이 장소의 위치를 확인하지 못했습니다.',
          )
    }
  }

  async function handleAddressLocate(address: string) {
    const requestId = searchLocationRequestRef.current + 1
    searchLocationRequestRef.current = requestId
    setSelectedRestaurantId(null)
    setSelectedSearchResult(null)
    setIsViewportSheetOpen(false)
    setNotice('')

    const isRoadAddress = isLikelyRoadAddress(address)
    const target: RestaurantSearchResult = {
      title: '등록할 위치',
      category: null,
      address: isRoadAddress ? null : address,
      roadAddress: isRoadAddress ? address : null,
      latitude: null,
      longitude: null,
      link: null,
    }

    try {
      const coordinate = await resolveRestaurantCoordinates(target)
      if (requestId !== searchLocationRequestRef.current) return
      setSelectedSearchResult({ ...target, ...coordinate, kind: 'manual' })
    } catch (error) {
      if (requestId !== searchLocationRequestRef.current) return
      throw error instanceof RestaurantSelectionError
        ? error
        : new RestaurantSelectionError(
            '입력한 주소의 위치를 확인하지 못했습니다.',
          )
    }
  }

  const handleSearchResultPositionChange = useCallback(
    (coordinate: { latitude: number; longitude: number }) => {
      setSelectedSearchResult((current) =>
        current?.kind === 'manual'
          ? { ...current, ...coordinate }
          : current,
      )
    },
    [],
  )

  function handleManualReview() {
    if (selectedSearchResult?.kind !== 'manual') return
    workflow.openManual({
      ...selectedSearchResult,
      title: '',
    })
  }

  async function handleSearchReview(result: RestaurantSearchResult) {
    searchLocationRequestRef.current += 1
    const resultKey = normalizeRestaurantIdentity(
      result.title,
      result.roadAddress || result.address,
    )
    const existingRestaurant = restaurants.find(
      (restaurant) => restaurant.sourceKey === resultKey,
    )
    if (!existingRestaurant) {
      workflow.openNew(result)
      return
    }

    setSelectedSearchResult(null)
    setSelectedRestaurantId(existingRestaurant.id)
    setNotice('')
    try {
      const reviews = await loadRestaurantReviews(existingRestaurant.id)
      const currentUserReview = reviews.find(
        (review) => review.userId === profile.id,
      )
      if (currentUserReview) {
        workflow.openEdit(existingRestaurant, currentUserReview)
      } else {
        workflow.openNew(result)
      }
    } catch {
      setNotice('기존 후기를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  async function handleReviewDeleted() {
    let message = '방문 기록을 삭제했습니다.'
    try {
      await refresh()
    } catch {
      message += ' 지도 정보는 잠시 후 다시 확인해 주세요.'
    }
    setNotice(message)
    setDetailRefreshKey((key) => key + 1)
  }

  return (
    <main className="map-page">
      <div className="map-layout">
        <aside className="map-sidebar" aria-label="음식점 검색과 선택 정보">
          <RestaurantSearch
            key={searchResetKey}
            viewport={viewport}
            manualLocation={
              selectedSearchResult?.kind === 'manual'
                ? selectedSearchResult
                : null
            }
            onLocate={handleSearchLocate}
            onLocateAddress={handleAddressLocate}
            onReview={handleSearchReview}
            onManualReview={handleManualReview}
            onClearLocation={handleClearSearchLocation}
            onResultsVisibilityChange={handleSearchResultsVisibilityChange}
          />

          {notice && (!selectedRestaurant || isMobile) && (
            <div className="home-notice" role="status">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice('')} aria-label="알림 닫기">
                <AppIcon name="x" />
              </button>
            </div>
          )}

          <div
            className={`restaurant-load-status restaurant-load-status--${status}`}
            aria-live="polite"
          >
            {status === 'loading' && <p>장소를 불러오는 중…</p>}
            {status === 'error' && (
              <div className="inline-error" role="alert">
                <p>{errorMessage}</p>
                <button type="button" onClick={() => void refresh().catch(() => undefined)}>
                  다시 시도
                </button>
              </div>
            )}
            {status === 'success' && restaurants.length === 0 && (
              <p>첫 기록을 남기면 지도에 장소가 나타나요.</p>
            )}
            {status === 'success' && restaurants.length > 0 && (
              <p>친구들이 남긴 장소 {restaurants.length}곳</p>
            )}
          </div>

          {selectedRestaurant && !isMobile && (
            <RestaurantDetail
              key={selectedRestaurant.id}
              restaurant={selectedRestaurant}
              currentUserId={profile.id}
              refreshKey={detailRefreshKey}
              notice={notice}
              onClearNotice={() => setNotice('')}
              onClose={() => {
                setSelectedRestaurantId(null)
                setNotice('')
              }}
              onAddReview={() =>
                workflow.openNew(restaurantToSearchResult(selectedRestaurant))
              }
              onEditReview={(review) => workflow.openEdit(selectedRestaurant, review)}
              onReviewsChanged={handleReviewDeleted}
            />
          )}

          {!isMobile && !selectedRestaurant && !hasSearchResults && (
            <ViewportRestaurantList
              restaurants={visibleRestaurants}
              status={status}
              onSelect={handleMarkerSelect}
            />
          )}
        </aside>

        <section className="map-canvas" aria-label="친구들의 맛집 지도">
          <NaverMap
            restaurants={restaurants}
            selectedRestaurant={selectedRestaurant}
            selectedSearchResult={selectedSearchResult}
            skipInitialLocation={Boolean(
              requestedRestaurantId || selectedRestaurantId,
            )}
            onSelectRestaurant={handleMarkerSelect}
            onSearchResultPositionChange={handleSearchResultPositionChange}
            onMapClick={handleMapClick}
            onViewportChange={handleViewportChange}
            onVisibleRestaurantsChange={handleVisibleRestaurantsChange}
          />
          {isMobile && visibleRestaurants.length > 0 && (
            <button
              type="button"
              className={`viewport-list-trigger${selectedRestaurant ? ' viewport-list-trigger--raised' : ''}`}
              aria-label="이 지역의 기록 보기"
              aria-expanded={isViewportSheetOpen}
              onClick={() => setIsViewportSheetOpen(true)}
            >
              이 지역 {visibleRestaurants.length}곳
            </button>
          )}
        </section>

        {selectedRestaurant && isMobile && (
          <RestaurantPreview
            key={selectedRestaurant.id}
            restaurant={selectedRestaurant}
            currentUserId={profile.id}
            onClose={() => {
              setSelectedRestaurantId(null)
              setNotice('')
            }}
            onAddReview={() =>
              workflow.openNew(restaurantToSearchResult(selectedRestaurant))
            }
            onEditReview={(review) =>
              workflow.openEdit(selectedRestaurant, review)
            }
          />
        )}
      </div>

      {isMobile && isViewportSheetOpen && visibleRestaurants.length > 0 && (
        <ViewportRestaurantSheet
          restaurants={visibleRestaurants}
          onClose={() => setIsViewportSheetOpen(false)}
          onSelect={handleMarkerSelect}
        />
      )}

      {workflow.editor && (
        <ReviewEditor
          key={workflow.editor.review?.id ?? `${workflow.editor.target.title}-new`}
          restaurantName={workflow.editor.target.title}
          restaurantAddress={
            workflow.editor.target.roadAddress || workflow.editor.target.address
          }
          review={workflow.editor.review}
          isManualLocation={workflow.editor.isManualLocation}
          onAddressSelect={workflow.closeEditor}
          onSubmit={workflow.submit}
          onClose={workflow.closeEditor}
        />
      )}
    </main>
  )
}
