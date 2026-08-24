export interface Profile {
  id: string
  nickname: string
  avatarUrl: string | null
}

export interface Restaurant {
  id: string
  name: string
  category: string | null
  address: string | null
  roadAddress: string | null
  latitude: number
  longitude: number
  naverLink: string | null
  source: string
  sourceKey: string
  createdBy: string | null
  createdAt: string
  averageRating: number | null
  reviewCount: number
}

export interface ReviewPhoto {
  id: string
  reviewId: string
  storagePath: string
  sortOrder: number
  signedUrl: string | null
}

export interface Review {
  id: string
  restaurantId: string
  userId: string
  authorNickname: string
  rating: number
  content: string | null
  visitedAt: string
  createdAt: string
  updatedAt: string
  photos: ReviewPhoto[]
}
