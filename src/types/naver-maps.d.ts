interface NaverMapOptions {
  center: NaverLatLng
  zoom: number
  zoomControl?: boolean
  zoomControlOptions?: {
    position?: number
    style?: number
  }
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

interface NaverMarkerOptions {
  map: NaverMapInstance
  position: NaverLatLng
  title?: string
}

interface NaverMarkerInstance {
  setMap(map: NaverMapInstance | null): void
}

interface NaverMapsEventListener {
  readonly eventName?: string
}

interface NaverMapsEventNamespace {
  addListener(
    target: NaverMarkerInstance,
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
  Event: NaverMapsEventNamespace
  Position: {
    RIGHT_CENTER: number
  }
  ZoomControlStyle: {
    SMALL: number
  }
}

interface Window {
  naver?: {
    maps: NaverMapsNamespace
  }
}
