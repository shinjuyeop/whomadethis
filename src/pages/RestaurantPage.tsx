import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon'
import type { AuthenticatedOutletContext } from '../components/AuthenticatedApp'
import { RestaurantDetail } from '../components/RestaurantDetail'
import { ReviewEditor } from '../components/ReviewEditor'
import { useRealtime } from '../hooks/useRealtime'
import {
  restaurantToSearchResult,
  useReviewWorkflow,
} from '../hooks/useReviewWorkflow'
import { loadRestaurant } from '../lib/restaurants'
import type { Restaurant } from '../types/database'

type PageStatus = 'loading' | 'ready' | 'missing' | 'error'

export function RestaurantPage() {
  const { restaurantId = '' } = useParams()
  const { profile } = useOutletContext<AuthenticatedOutletContext>()
  const { revision } = useRealtime()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [status, setStatus] = useState<PageStatus>('loading')
  const [refreshKey, setRefreshKey] = useState(0)
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    try {
      const nextRestaurant = await loadRestaurant(restaurantId)
      setRestaurant(nextRestaurant)
      setStatus(nextRestaurant ? 'ready' : 'missing')
    } catch {
      setStatus('error')
    }
  }, [restaurantId])

  useEffect(() => {
    let active = true
    void loadRestaurant(restaurantId)
      .then((nextRestaurant) => {
        if (!active) return
        setRestaurant(nextRestaurant)
        setStatus(nextRestaurant ? 'ready' : 'missing')
      })
      .catch(() => {
        if (active) setStatus('error')
      })
    return () => {
      active = false
    }
  }, [restaurantId, revision])

  const workflow = useReviewWorkflow({
    userId: profile.id,
    onSaved: async ({ message }) => {
      let nextMessage = message
      try {
        await refresh()
      } catch {
        nextMessage += ' 음식점 정보는 잠시 후 다시 확인해 주세요.'
      }
      setRefreshKey((key) => key + 1)
      setNotice(nextMessage)
    },
  })

  return (
    <main className="restaurant-page content-page">
      <div className="restaurant-page-column">
        <Link className="back-link" to="/">
          <AppIcon name="arrow" /> 지도
        </Link>

        {status === 'loading' && <div className="content-loading">음식점 정보를 불러오는 중…</div>}
        {status === 'error' && (
          <div className="content-error" role="alert">
            <p>음식점 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
            <button type="button" onClick={() => void refresh()}>다시 시도</button>
          </div>
        )}
        {status === 'missing' && (
          <div className="empty-state"><strong>음식점을 찾을 수 없어요.</strong></div>
        )}
        {status === 'ready' && restaurant && (
          <RestaurantDetail
            restaurant={restaurant}
            currentUserId={profile.id}
            refreshKey={refreshKey}
            notice={notice}
            onClearNotice={() => setNotice('')}
            onClose={() => undefined}
            onAddReview={() => workflow.openNew(restaurantToSearchResult(restaurant))}
            onEditReview={(review) => workflow.openEdit(restaurant, review)}
            onReviewsChanged={async () => {
              let message = '방문 기록을 삭제했습니다.'
              try {
                await refresh()
              } catch {
                message += ' 음식점 정보는 잠시 후 다시 확인해 주세요.'
              }
              setRefreshKey((key) => key + 1)
              setNotice(message)
            }}
            showClose={false}
          />
        )}
      </div>

      {workflow.editor && (
        <ReviewEditor
          key={workflow.editor.review?.id ?? `${workflow.editor.target.title}-new`}
          restaurantName={workflow.editor.target.title}
          restaurantAddress={workflow.editor.target.roadAddress || workflow.editor.target.address}
          review={workflow.editor.review}
          onSubmit={workflow.submit}
          onClose={workflow.closeEditor}
        />
      )}
    </main>
  )
}
