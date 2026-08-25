export interface MapCoordinate {
  latitude: number
  longitude: number
}

export interface MapBounds {
  south: number
  west: number
  north: number
  east: number
}

export interface MapViewport {
  center: MapCoordinate
  bounds: MapBounds
}
