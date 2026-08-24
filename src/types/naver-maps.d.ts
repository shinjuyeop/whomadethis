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

interface NaverMapsNamespace {
  Map: new (element: HTMLElement, options: NaverMapOptions) => NaverMapInstance
  LatLng: new (latitude: number, longitude: number) => NaverLatLng
}

interface Window {
  naver?: {
    maps: NaverMapsNamespace
  }
}
