import { useEffect, useRef, useState } from 'react'
import { loadNaverMaps } from '../lib/naverMaps'

const SEOUL_CITY_HALL = {
  latitude: 37.5666103,
  longitude: 126.9783882,
}

type MapState = 'loading' | 'ready' | 'error' | 'missing-config'

export function NaverMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const clientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID?.trim()
  const [state, setState] = useState<MapState>(
    clientId ? 'loading' : 'missing-config',
  )
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!clientId || !containerRef.current) {
      return
    }

    let cancelled = false
    let map: NaverMapInstance | null = null

    loadNaverMaps(clientId)
      .then(() => {
        if (cancelled || !containerRef.current || !window.naver?.maps) {
          return
        }

        map = new window.naver.maps.Map(containerRef.current, {
          center: new window.naver.maps.LatLng(
            SEOUL_CITY_HALL.latitude,
            SEOUL_CITY_HALL.longitude,
          ),
          zoom: 13,
          zoomControl: true,
        })
        setState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : '지도를 불러오는 중 오류가 발생했습니다.',
        )
        setState('error')
      })

    return () => {
      cancelled = true
      map?.destroy?.()
    }
  }, [clientId])

  if (state === 'missing-config') {
    return (
      <div className="map-message" role="status">
        <strong>NAVER Maps 설정이 필요합니다.</strong>
        <span>
          <code>.env.local</code>에 <code>VITE_NAVER_MAP_CLIENT_ID</code>를
          설정한 뒤 개발 서버를 다시 시작하세요.
        </span>
      </div>
    )
  }

  return (
    <div className="map-shell">
      {state === 'loading' && (
        <div className="map-overlay" role="status">
          지도를 불러오는 중입니다…
        </div>
      )}
      {state === 'error' && (
        <div className="map-overlay map-overlay--error" role="alert">
          <strong>지도를 표시하지 못했습니다.</strong>
          <span>{errorMessage}</span>
          <span>Client ID와 Web 서비스 URL 등록 상태를 확인하세요.</span>
        </div>
      )}
      <div ref={containerRef} className="map-container" aria-label="음식점 지도" />
    </div>
  )
}
