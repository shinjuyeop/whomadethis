interface NaverMapOptions {
  center: NaverLatLng
  zoom: number
  zoomControl?: boolean
}

interface NaverLatLng {
  readonly x: number
  readonly y: number
}

interface NaverMapInstance {
  destroy?: () => void
  setCenter(center: NaverLatLng): void
  setZoom(zoom: number): void
}

interface NaverPoint {
  readonly x: number
  readonly y: number
}

interface NaverHtmlIcon {
  content: string
  anchor?: NaverPoint
}

interface NaverMarkerOptions {
  map: NaverMapInstance
  position: NaverLatLng
  title?: string
  icon?: NaverHtmlIcon
}

interface NaverMarkerInstance {
  setMap(map: NaverMapInstance | null): void
  setPosition(position: NaverLatLng): void
}

interface NaverMapsEventListener {
  readonly eventName?: string
}

interface NaverMapsEventNamespace {
  addListener(
    target: NaverMarkerInstance | NaverMapInstance,
    eventName: string,
    listener: () => void,
  ): NaverMapsEventListener
  removeListener(listener: NaverMapsEventListener): void
  trigger(target: NaverMapInstance, eventName: string): void
}

interface NaverMapsNamespace {
  Map: new (element: HTMLElement, options: NaverMapOptions) => NaverMapInstance
  Marker: new (options: NaverMarkerOptions) => NaverMarkerInstance
  LatLng: new (latitude: number, longitude: number) => NaverLatLng
  Point: new (x: number, y: number) => NaverPoint
  Event: NaverMapsEventNamespace
}

interface Window {
  naver?: {
    maps: NaverMapsNamespace
  }
}
