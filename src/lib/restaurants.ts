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
  average_rating: number | null
  review_count: number
}

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

export async function resolveRestaurantCoordinates(
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
    averageRating:
      row.average_rating === null ? null : Number(row.average_rating),
    reviewCount: Number(row.review_count),
  }
}

export async function loadRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await getSupabaseClient().rpc(
    'list_restaurants_with_review_stats',
  )

  if (error) {
    throw new Error('음식점 목록을 불러오지 못했습니다.')
  }

  return ((data ?? []) as RestaurantRow[]).map(toRestaurant)
}
