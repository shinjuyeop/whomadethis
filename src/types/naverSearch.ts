export interface RestaurantSearchResult {
  title: string
  category: string | null
  address: string | null
  roadAddress: string | null
  latitude: number | null
  longitude: number | null
  link: string | null
}

export interface LocatedRestaurantSearchResult
  extends RestaurantSearchResult {
  latitude: number
  longitude: number
}

export interface RestaurantSearchResponse {
  total: number
  items: RestaurantSearchResult[]
}
