import { useCallback, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { AuthenticatedOutletContext } from '../components/AuthenticatedApp'
import { NaverMap } from '../components/NaverMap'
import { RestaurantDetail } from '../components/RestaurantDetail'
import { RestaurantSearch } from '../components/RestaurantSearch'
import {
  ReviewEditor,
  type ReviewEditorSubmission,
} from '../components/ReviewEditor'
import { useRestaurants } from '../hooks/useRestaurants'
import {
  removeReviewImages,
  ReviewImageError,
  uploadReviewImages,
  type ImageUploadProgress,
} from '../lib/reviewImages'
import {
  createVisitReview,
  updateReview,
} from '../lib/reviews'
import type { Restaurant, Review } from '../types/database'
import type { RestaurantSearchResult } from '../types/naverSearch'

interface ReviewEditorState {
  target: RestaurantSearchResult
  review?: Review
}

function restaurantToSearchResult(
  restaurant: Restaurant,
): RestaurantSearchResult {
  return {
    title: restaurant.name,
    category: restaurant.category,
    address: restaurant.address,
    roadAddress: restaurant.roadAddress,
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
    link: restaurant.naverLink,
  }
}

export function HomePage() {
  const { profile } = useOutletContext<AuthenticatedOutletContext>()
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<
    string | null
  >(null)
  const [editor, setEditor] = useState<ReviewEditorState | null>(null)
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)
  const [notice, setNotice] = useState('')
  const { restaurants, status, errorMessage, refresh } = useRestaurants()
  const selectedRestaurant =
    restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ??
    null

  const handleMarkerSelect = useCallback((restaurant: Restaurant) => {
    setSelectedRestaurantId(restaurant.id)
    setNotice('')
  }, [])

  function handleSearchSelect(result: RestaurantSearchResult) {
    setEditor({ target: result })
  }

  async function refreshAfterReviewChange() {
    try {
      await refresh()
      return true
    } catch {
      return false
    } finally {
      setDetailRefreshKey((key) => key + 1)
    }
  }

  async function handleCreateReview(
    submission: ReviewEditorSubmission,
    onProgress: (progress: ImageUploadProgress) => void,
  ) {
    if (!editor) return

    const created = await createVisitReview(editor.target, submission.fields)
    const warnings: string[] = []

    if (submission.newFiles.length > 0) {
      try {
        const uploadResult = await uploadReviewImages(
          profile.id,
          created.reviewId,
          submission.newFiles,
          [],
          onProgress,
        )
        if (uploadResult.failedCount > 0) {
          warnings.push(
            `사진 ${uploadResult.failedCount}장을 올리지 못했어요. 기록은 저장됐습니다.`,
          )
        }
      } catch {
        warnings.push('사진을 올리지 못했지만 방문 기록은 저장됐습니다.')
      }
    }

    try {
      await refresh()
    } catch {
      warnings.push('지도 목록을 새로 불러오지 못했습니다.')
    }
    setSelectedRestaurantId(created.restaurantId)
    setDetailRefreshKey((key) => key + 1)
    setNotice(
      warnings.length > 0
        ? warnings.join(' ')
        : '방문 기록을 저장했습니다.',
    )
    setEditor(null)
  }

  async function handleUpdateReview(
    submission: ReviewEditorSubmission,
    onProgress: (progress: ImageUploadProgress) => void,
  ) {
    if (!editor?.review) return

    const review = editor.review
    await updateReview(review.id, submission.fields)
    const warnings: string[] = []
    let remainingPhotos = review.photos
    let photoRemovalSucceeded = true

    if (submission.removedPhotos.length > 0) {
      try {
        await removeReviewImages(submission.removedPhotos)
        const removedIds = new Set(
          submission.removedPhotos.map((photo) => photo.id),
        )
        remainingPhotos = review.photos.filter(
          (photo) => !removedIds.has(photo.id),
        )
      } catch (error) {
        photoRemovalSucceeded = false
        warnings.push(
          error instanceof ReviewImageError
            ? error.message
            : '선택한 사진을 정리하지 못했습니다.',
        )
      }
    }

    if (submission.newFiles.length > 0) {
      if (!photoRemovalSucceeded) {
        warnings.push('사진 삭제를 먼저 해결한 뒤 새 사진을 추가해 주세요.')
      } else {
        try {
          const uploadResult = await uploadReviewImages(
            profile.id,
            review.id,
            submission.newFiles,
            remainingPhotos.map((photo) => photo.sortOrder),
            onProgress,
          )
          if (uploadResult.failedCount > 0) {
            warnings.push(
              `사진 ${uploadResult.failedCount}장을 올리지 못했어요.`,
            )
          }
        } catch {
          warnings.push('새 사진을 올리지 못했습니다.')
        }
      }
    }

    const refreshed = await refreshAfterReviewChange()
    if (!refreshed) {
      warnings.push('지도 정보를 새로 불러오지 못했습니다.')
    }
    setNotice(
      warnings.length > 0
        ? `방문 기록은 수정됐습니다. ${warnings.join(' ')}`
        : '방문 기록을 수정했습니다.',
    )
    setEditor(null)
  }

  return (
    <main className="map-page">
      <div className="map-layout">
        <aside className="map-sidebar" aria-label="음식점 검색과 선택 정보">
          <RestaurantSearch onSelect={handleSearchSelect} />

          {notice && !selectedRestaurant && (
            <div className="home-notice" role="status">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice('')}>
                ×
              </button>
            </div>
          )}

          <div className="restaurant-load-status" aria-live="polite">
            {status === 'loading' && <p>저장된 장소를 불러오는 중…</p>}
            {status === 'error' && (
              <div className="inline-error" role="alert">
                <p>{errorMessage}</p>
                <button
                  type="button"
                  onClick={() => void refresh().catch(() => undefined)}
                >
                  다시 시도
                </button>
              </div>
            )}
            {status === 'success' && restaurants.length === 0 && (
              <p>첫 방문 기록을 남기면 지도에 장소가 나타나요.</p>
            )}
            {status === 'success' && restaurants.length > 0 && (
              <p>함께 저장한 장소 {restaurants.length}곳</p>
            )}
          </div>

          {selectedRestaurant && (
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
                setEditor({
                  target: restaurantToSearchResult(selectedRestaurant),
                })
              }
              onEditReview={(review) =>
                setEditor({
                  target: restaurantToSearchResult(selectedRestaurant),
                  review,
                })
              }
              onReviewsChanged={async () => {
                const refreshed = await refreshAfterReviewChange()
                setNotice(
                  refreshed
                    ? '방문 기록을 삭제했습니다.'
                    : '기록은 삭제됐지만 지도 정보를 새로 불러오지 못했습니다.',
                )
              }}
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

      {editor && (
        <ReviewEditor
          key={editor.review?.id ?? `${editor.target.title}-new`}
          restaurantName={editor.target.title}
          restaurantAddress={editor.target.roadAddress || editor.target.address}
          review={editor.review}
          onSubmit={editor.review ? handleUpdateReview : handleCreateReview}
          onClose={() => setEditor(null)}
        />
      )}
    </main>
  )
}
