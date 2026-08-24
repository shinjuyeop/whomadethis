import { useEffect, useRef, useState } from 'react'
import { useRestaurantMarkers } from '../hooks/useRestaurantMarkers'
import { loadNaverMaps } from '../lib/naverMaps'
import type { Restaurant } from '../types/database'
import { AppIcon } from './AppIcon'

const SEOUL_CITY_HALL = {
  latitude: 37.5666103,
  longitude: 126.9783882,
}

type MapState = 'loading' | 'ready' | 'error' | 'missing-config'
type LocationState = 'idle' | 'locating' | 'located' | 'error'

interface NaverMapProps {
  restaurants: Restaurant[]
  selectedRestaurant: Restaurant | null
  onSelectRestaurant: (restaurant: Restaurant) => void
  onMapClick: () => void
}

export function NaverMap({
  restaurants,
  selectedRestaurant,
  onSelectRestaurant,
  onMapClick,
}: NaverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<NaverMapInstance | null>(null)
  const currentLocationMarkerRef = useRef<NaverMarkerInstance | null>(null)
  const [map, setMap] = useState<NaverMapInstance | null>(null)
  const clientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID?.trim()
  const [state, setState] = useState<MapState>(
    clientId ? 'loading' : 'missing-config',
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [locationState, setLocationState] = useState<LocationState>('idle')
  const [locationMessage, setLocationMessage] = useState('')

  useEffect(() => {
    if (!clientId || !containerRef.current) {
      return
    }

    let cancelled = false
    loadNaverMaps(clientId)
      .then(() => {
        if (cancelled || !containerRef.current || !window.naver?.maps) {
          return
        }

        const nextMap = new window.naver.maps.Map(containerRef.current, {
          center: new window.naver.maps.LatLng(
            SEOUL_CITY_HALL.latitude,
            SEOUL_CITY_HALL.longitude,
          ),
          zoom: 13,
          zoomControl: false,
        })
        mapRef.current = nextMap
        setMap(nextMap)
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
      currentLocationMarkerRef.current?.setMap(null)
      currentLocationMarkerRef.current = null
      mapRef.current?.destroy?.()
      mapRef.current = null
      setMap(null)
    }
  }, [clientId])

  useRestaurantMarkers(map, restaurants, onSelectRestaurant)

  useEffect(() => {
    if (!map || !window.naver?.maps) return
    const listener = window.naver.maps.Event.addListener(map, 'click', onMapClick)
    return () => window.naver?.maps.Event.removeListener(listener)
  }, [map, onMapClick])

  useEffect(() => {
    if (
      state !== 'ready' ||
      !mapRef.current ||
      !window.naver?.maps ||
      !selectedRestaurant
    ) {
      return
    }

    mapRef.current.setCenter(
      new window.naver.maps.LatLng(
        selectedRestaurant.latitude,
        selectedRestaurant.longitude,
      ),
    )
    mapRef.current.setZoom(16)
  }, [selectedRestaurant, state])

  useEffect(() => {
    if (state !== 'ready' || !map || !containerRef.current) {
      return
    }

    const observer = new ResizeObserver(() => {
      if (window.naver?.maps) {
        window.naver.maps.Event.trigger(map, 'resize')
      }
    })
    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [map, state])

  function showCurrentLocation() {
    if (locationState === 'locating' || state !== 'ready' || !mapRef.current) {
      return
    }
    if (!navigator.geolocation) {
      setLocationState('error')
      setLocationMessage('이 브라우저에서는 위치 서비스를 사용할 수 없습니다.')
      return
    }

    setLocationState('locating')
    setLocationMessage('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!mapRef.current || !window.naver?.maps) return
        const { maps } = window.naver
        const position = new maps.LatLng(coords.latitude, coords.longitude)
        if (currentLocationMarkerRef.current) {
          currentLocationMarkerRef.current.setPosition(position)
        } else {
          currentLocationMarkerRef.current = new maps.Marker({
            map: mapRef.current,
            position,
            title: '현재 위치',
            icon: {
              content:
                '<div class="current-location-marker" role="img" aria-label="현재 위치"><span></span></div>',
              anchor: new maps.Point(11, 11),
            },
          })
        }
        mapRef.current.setCenter(position)
        mapRef.current.setZoom(16)
        setLocationState('located')
      },
      (error) => {
        setLocationState('error')
        if (error.code === error.PERMISSION_DENIED) {
          setLocationMessage('위치 권한이 필요합니다. 브라우저 설정을 확인해 주세요.')
        } else if (error.code === error.TIMEOUT) {
          setLocationMessage('위치 확인 시간이 초과됐습니다. 다시 시도해 주세요.')
        } else {
          setLocationMessage('현재 위치를 확인하지 못했습니다. 다시 시도해 주세요.')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    )
  }

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
      {state === 'ready' && (
        <div
          className={`map-location-control${selectedRestaurant ? ' map-location-control--raised' : ''}`}
        >
          {locationMessage && (
            <p className="map-location-message" role="alert">
              {locationMessage}
            </p>
          )}
          <button
            type="button"
            aria-label="내 위치로 이동"
            aria-pressed={locationState === 'located'}
            disabled={locationState === 'locating'}
            onClick={showCurrentLocation}
          >
            <AppIcon name="location" />
          </button>
        </div>
      )}
    </div>
  )
}
