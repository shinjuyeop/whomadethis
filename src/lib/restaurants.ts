import type { RestaurantSearchResult } from '../types/naverSearch'
import type { Restaurant } from '../types/database'
import { getSupabaseClient } from './supabase'

interface RestaurantRow {
  id: string
  name: string
  category: string | null
  address: string | null
  road_address: string | null
  latitude: number
  longitude: number
  naver_link: string | null
  source: string
  source_key: string
  created_by: string | null
  created_at: string
}

const RESTAURANT_COLUMNS =
  'id,name,category,address,road_address,latitude,longitude,naver_link,source,source_key,created_by,created_at'

function toRestaurant(row: RestaurantRow): Restaurant {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    address: row.address,
    roadAddress: row.road_address,
    latitude: row.latitude,
    longitude: row.longitude,
    naverLink: row.naver_link,
    source: row.source,
    sourceKey: row.source_key,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export async function loadRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await getSupabaseClient()
    .from('restaurants')
    .select(RESTAURANT_COLUMNS)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error('음식점 목록을 불러오지 못했습니다.')
  }

  return ((data ?? []) as RestaurantRow[]).map(toRestaurant)
}

export async function findOrCreateRestaurant(
  result: RestaurantSearchResult,
): Promise<Restaurant> {
  if (
    result.latitude === null ||
    result.longitude === null ||
    (!result.roadAddress && !result.address)
  ) {
    throw new Error('이 장소는 위치 정보가 부족해 지도에 표시할 수 없습니다.')
  }

  const { data, error } = await getSupabaseClient()
    .rpc('find_or_create_restaurant', {
      p_name: result.title,
      p_category: result.category,
      p_address: result.address,
      p_road_address: result.roadAddress,
      p_latitude: result.latitude,
      p_longitude: result.longitude,
      p_naver_link: result.link,
    })
    .select(RESTAURANT_COLUMNS)
    .single()

  if (error || !data) {
    throw new Error('장소를 지도에 표시하지 못했습니다.')
  }

  return toRestaurant(data as RestaurantRow)
}
