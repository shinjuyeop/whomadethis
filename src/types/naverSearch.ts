export interface NaverLocalSearchItem {
  title: string
  link: string
  category: string
  description: string
  telephone: string
  address: string
  roadAddress: string
  mapx: string
  mapy: string
}

export interface NaverLocalSearchResponse {
  lastBuildDate: string
  total: number
  start: number
  display: number
  items: NaverLocalSearchItem[]
}
