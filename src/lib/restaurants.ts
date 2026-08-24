import type { RestaurantSearchResult } from '../types/naverSearch'
import type { GeocodeResponse } from '../types/naverGeocode'
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
const LOCATION_NOT_FOUND_MESSAGE = '이 장소의 위치를 확인하지 못했습니다.'

export class RestaurantSelectionError extends Error {}

function isGeocodeResponse(value: unknown): value is GeocodeResponse {
  if (typeof value !== 'object' || value === null) return false

  const latitude = Reflect.get(value, 'latitude')
  const longitude = Reflect.get(value, 'longitude')
  return (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  )
}

async function geocodeAddress(address: string): Promise<GeocodeResponse> {
  try {
    const response = await fetch(
      `/api/naver-geocode?address=${encodeURIComponent(address)}`,
    )
    let body: unknown

    try {
      body = await response.json()
    } catch {
      throw new RestaurantSelectionError(LOCATION_NOT_FOUND_MESSAGE)
    }

    if (!response.ok || !isGeocodeResponse(body)) {
      throw new RestaurantSelectionError(LOCATION_NOT_FOUND_MESSAGE)
    }

    return body
  } catch (error) {
    if (error instanceof RestaurantSelectionError) throw error
    throw new RestaurantSelectionError(LOCATION_NOT_FOUND_MESSAGE)
  }
}

async function resolveCoordinates(
  result: RestaurantSearchResult,
): Promise<GeocodeResponse> {
  if (result.latitude !== null && result.longitude !== null) {
    return {
      latitude: result.latitude,
      longitude: result.longitude,
    }
  }

  const address = result.roadAddress || result.address
  if (!address) {
    throw new RestaurantSelectionError(LOCATION_NOT_FOUND_MESSAGE)
  }

  return geocodeAddress(address)
}

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
  if (!result.roadAddress && !result.address) {
    throw new RestaurantSelectionError(LOCATION_NOT_FOUND_MESSAGE)
  }

  const coordinates = await resolveCoordinates(result)

  const { data, error } = await getSupabaseClient()
    .rpc('find_or_create_restaurant', {
      p_name: result.title,
      p_category: result.category,
      p_address: result.address,
      p_road_address: result.roadAddress,
      p_latitude: coordinates.latitude,
      p_longitude: coordinates.longitude,
      p_naver_link: result.link,
    })
    .select(RESTAURANT_COLUMNS)
    .single()

  if (error || !data) {
    throw new Error('장소를 지도에 표시하지 못했습니다.')
  }

  return toRestaurant(data as RestaurantRow)
}
