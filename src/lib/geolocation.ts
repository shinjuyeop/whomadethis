import type { MapCoordinate } from '../types/map'

const LOCATION_TIMEOUT_MS = 7_000
const LOCATION_MAX_AGE_MS = 60_000

let recentLocation: { coordinate: MapCoordinate; resolvedAt: number } | null = null

export function resolveCurrentLocation(): Promise<MapCoordinate> {
  if (
    recentLocation &&
    Date.now() - recentLocation.resolvedAt <= LOCATION_MAX_AGE_MS
  ) {
    return Promise.resolve(recentLocation.coordinate)
  }

  if (!navigator.geolocation) {
    return Promise.reject(new Error('GEOLOCATION_UNAVAILABLE'))
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coordinate = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        }
        recentLocation = { coordinate, resolvedAt: Date.now() }
        resolve(coordinate)
      },
      reject,
      {
        enableHighAccuracy: true,
        timeout: LOCATION_TIMEOUT_MS,
        maximumAge: LOCATION_MAX_AGE_MS,
      },
    )
  })
}
