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
}
