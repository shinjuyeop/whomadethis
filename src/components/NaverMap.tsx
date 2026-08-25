import { useCallback, useEffect, useRef, useState } from 'react'
import { useRestaurantMarkers } from '../hooks/useRestaurantMarkers'
import { resolveCurrentLocation } from '../lib/geolocation'
import { distanceInMeters } from '../lib/mapDistance'
import { loadNaverMaps } from '../lib/naverMaps'
import type { Restaurant } from '../types/database'
import type { MapCoordinate, MapViewport } from '../types/map'
import type { LocatedRestaurantSearchResult } from '../types/naverSearch'
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
  selectedSearchResult: LocatedRestaurantSearchResult | null
  onSelectRestaurant: (restaurant: Restaurant) => void
  onSearchResultPositionChange: (coordinate: MapCoordinate) => void
  onMapClick: () => void
  onViewportChange: (viewport: MapViewport) => void
  onVisibleRestaurantsChange: (restaurants: Restaurant[]) => void
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[character] ?? character,
  )
}

function coordinateFromLatLng(latLng: NaverLatLng): MapCoordinate {
  return {
    latitude: latLng.lat(),
    longitude: latLng.lng(),
  }
}

function manualLocationMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === 1) {
      return '위치 권한이 꺼져 있습니다. 브라우저 설정에서 변경할 수 있어요.'
    }
    if (error.code === 3) {
      return '위치 확인 시간이 초과됐습니다. 다시 시도해 주세요.'
    }
  }
  return '현재 위치를 확인하지 못했습니다. 다시 시도해 주세요.'
}

export function NaverMap({
  restaurants,
  selectedRestaurant,
  selectedSearchResult,
  onSelectRestaurant,
  onSearchResultPositionChange,
  onMapClick,
  onViewportChange,
  onVisibleRestaurantsChange,
}: NaverMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<NaverMapInstance | null>(null)
  const restaurantsRef = useRef(restaurants)
  const currentLocationMarkerRef = useRef<NaverMarkerInstance | null>(null)
  const searchResultMarkerRef = useRef<NaverMarkerInstance | null>(null)
  const initialLocationRequestedRef = useRef(false)
  const [map, setMap] = useState<NaverMapInstance | null>(null)
  const clientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID?.trim()
  const [state, setState] = useState<MapState>(
    clientId ? 'loading' : 'missing-config',
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [locationState, setLocationState] = useState<LocationState>('idle')
  const [locationMessage, setLocationMessage] = useState('')

  useEffect(() => {
    restaurantsRef.current = restaurants
  }, [restaurants])

  useEffect(() => {
    if (!clientId || !containerRef.current) return

    let cancelled = false
    loadNaverMaps(clientId)
      .then(() => {
        if (cancelled || !containerRef.current || !window.naver?.maps) return
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
        if (cancelled) return
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
      searchResultMarkerRef.current?.setMap(null)
      searchResultMarkerRef.current = null
      const mapToDestroy = mapRef.current
      mapRef.current = null
      setMap(null)
      window.setTimeout(() => mapToDestroy?.destroy?.(), 0)
    }
  }, [clientId])

  useRestaurantMarkers(map, restaurants, onSelectRestaurant)

  const updateViewport = useCallback(() => {
    const maps = window.naver?.maps
    if (!map || !maps) return
    const bounds = map.getBounds()
    const center = coordinateFromLatLng(map.getCenter())
    const southWest = coordinateFromLatLng(bounds.getSW())
    const northEast = coordinateFromLatLng(bounds.getNE())
    onViewportChange({
      center,
      bounds: {
        south: southWest.latitude,
        west: southWest.longitude,
        north: northEast.latitude,
        east: northEast.longitude,
      },
    })

    // The MVP dataset is already loaded for markers. Filter it only after an
    // interaction settles and keep the closest records first for map continuity.
    const visibleRestaurants = restaurantsRef.current
      .filter((restaurant) =>
        bounds.hasLatLng(
          new maps.LatLng(
            restaurant.latitude,
            restaurant.longitude,
          ),
        ),
      )
      .sort(
        (first, second) =>
          distanceInMeters(center, first) - distanceInMeters(center, second),
      )
    onVisibleRestaurantsChange(visibleRestaurants)
  }, [map, onViewportChange, onVisibleRestaurantsChange])

  useEffect(() => {
    const event = window.naver?.maps?.Event
    if (!map || !event) return
    const listener = event.addListener(map, 'idle', updateViewport)
    const frame = window.requestAnimationFrame(updateViewport)
    return () => {
      window.cancelAnimationFrame(frame)
      event.removeListener(listener)
    }
  }, [map, updateViewport])

  useEffect(() => {
    const frame = window.requestAnimationFrame(updateViewport)
    return () => window.cancelAnimationFrame(frame)
  }, [restaurants, updateViewport])

  useEffect(() => {
    const event = window.naver?.maps?.Event
    if (!map || !event) return
    const listener = event.addListener(map, 'click', onMapClick)
    return () => event.removeListener(listener)
  }, [map, onMapClick])

  const showLocation = useCallback((coordinate: MapCoordinate) => {
    if (!mapRef.current || !window.naver?.maps) return
    const { maps } = window.naver
    const position = new maps.LatLng(
      coordinate.latitude,
      coordinate.longitude,
    )
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
    setLocationMessage('')
  }, [])

  useEffect(() => {
    if (state !== 'ready' || initialLocationRequestedRef.current) return
    initialLocationRequestedRef.current = true
    let active = true
    setLocationState('locating')
    void resolveCurrentLocation()
      .then((coordinate) => {
        if (active) showLocation(coordinate)
      })
      .catch(() => {
        if (!active) return
        setLocationState('error')
        setLocationMessage(
          '현재 위치를 사용할 수 없어 기본 위치를 표시했어요.',
        )
      })
    return () => {
      active = false
    }
  }, [showLocation, state])

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
    searchResultMarkerRef.current?.setMap(null)
    searchResultMarkerRef.current = null

    if (
      state !== 'ready' ||
      !map ||
      !window.naver?.maps ||
      !selectedSearchResult
    ) {
      return
    }

    const { maps } = window.naver
    const position = new maps.LatLng(
      selectedSearchResult.latitude,
      selectedSearchResult.longitude,
    )
    const isManualLocation = selectedSearchResult.kind === 'manual'
    const markerTitle = isManualLocation
      ? '등록할 위치'
      : selectedSearchResult.title
    const title = escapeHtml(markerTitle)
    const marker = new maps.Marker({
      map,
      position,
      title: markerTitle,
      draggable: isManualLocation,
      icon: {
        content: `<div class="search-location-marker${isManualLocation ? ' search-location-marker--draggable' : ''}" role="img" aria-label="${title}${isManualLocation ? '. 핀을 움직여 위치를 조정할 수 있습니다.' : ' 위치'}"><strong>${title}</strong><span><i></i></span></div>`,
        anchor: new maps.Point(90, 62),
      },
    })
    const dragListener = isManualLocation
      ? maps.Event.addListener(marker, 'dragend', () => {
          onSearchResultPositionChange(
            coordinateFromLatLng(marker.getPosition()),
          )
        })
      : null
    searchResultMarkerRef.current = marker
    map.setCenter(position)
    map.setZoom(16)

    return () => {
      if (dragListener) maps.Event.removeListener(dragListener)
      marker.setMap(null)
      if (searchResultMarkerRef.current === marker) {
        searchResultMarkerRef.current = null
      }
    }
  }, [map, onSearchResultPositionChange, selectedSearchResult, state])

  useEffect(() => {
    if (state !== 'ready' || !map || !containerRef.current) return
    const observer = new ResizeObserver(() => {
      if (window.naver?.maps) window.naver.maps.Event.trigger(map, 'resize')
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [map, state])

  function showCurrentLocation() {
    if (locationState === 'locating' || state !== 'ready' || !mapRef.current) {
      return
    }
    setLocationState('locating')
    setLocationMessage('')
    void resolveCurrentLocation()
      .then(showLocation)
      .catch((error: unknown) => {
        setLocationState('error')
        setLocationMessage(manualLocationMessage(error))
      })
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
            <p className="map-location-message" role="status">
              {locationMessage}
            </p>
          )}
          <button
            type="button"
            aria-label="현재 위치로 이동"
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
