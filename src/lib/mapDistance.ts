import type { MapCoordinate, MapViewport } from '../types/map'

const EARTH_RADIUS_METERS = 6_371_000

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

export function distanceInMeters(
  first: MapCoordinate,
  second: MapCoordinate,
) {
  const latitudeDelta = toRadians(second.latitude - first.latitude)
  const longitudeDelta = toRadians(second.longitude - first.longitude)
  const firstLatitude = toRadians(first.latitude)
  const secondLatitude = toRadians(second.latitude)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2

  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  )
}

export function isCoordinateInViewport(
  coordinate: MapCoordinate,
  viewport: MapViewport,
) {
  const { bounds } = viewport
  return (
    coordinate.latitude >= bounds.south &&
    coordinate.latitude <= bounds.north &&
    coordinate.longitude >= bounds.west &&
    coordinate.longitude <= bounds.east
  )
}

export function hasMeaningfulViewportChange(
  previous: MapViewport,
  current: MapViewport,
) {
  const previousSpan = distanceInMeters(
    { latitude: previous.bounds.south, longitude: previous.bounds.west },
    { latitude: previous.bounds.north, longitude: previous.bounds.east },
  )
  const currentSpan = distanceInMeters(
    { latitude: current.bounds.south, longitude: current.bounds.west },
    { latitude: current.bounds.north, longitude: current.bounds.east },
  )
  const movementThreshold = Math.max(200, Math.min(previousSpan * 0.18, 2_000))
  const zoomRatio =
    Math.max(previousSpan, currentSpan) /
    Math.max(1, Math.min(previousSpan, currentSpan))

  return (
    distanceInMeters(previous.center, current.center) >= movementThreshold ||
    zoomRatio >= 1.35
  )
}
