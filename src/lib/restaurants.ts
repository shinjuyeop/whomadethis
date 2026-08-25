import type { RestaurantSearchResult } from '../types/naverSearch'
import type { GeocodeResponse } from '../types/naverGeocode'
import type { Restaurant } from '../types/database'
import { getSupabaseClient } from './supabase'
import { createSignedReviewImageUrls } from './reviewImages'

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
  cover_photo_path: string | null
}

const LOCATION_NOT_FOUND_MESSAGE = '이 장소의 위치를 확인하지 못했습니다.'
const geocodeCache = new Map<string, Promise<GeocodeResponse>>()

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
  const cacheKey = address.trim().toLowerCase().replace(/\s+/g, ' ')
  const cached = geocodeCache.get(cacheKey)
  if (cached) return cached

  const request = requestGeocodeAddress(address)
  geocodeCache.set(cacheKey, request)
  request.catch(() => geocodeCache.delete(cacheKey))
  return request
}

async function requestGeocodeAddress(address: string): Promise<GeocodeResponse> {
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

function toRestaurant(
  row: RestaurantRow,
  signedUrls: Map<string, string>,
): Restaurant {
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
    coverPhotoUrl: row.cover_photo_path
      ? signedUrls.get(row.cover_photo_path) ?? null
      : null,
  }
}

async function signedCoverUrls(rows: RestaurantRow[]) {
  const paths = rows.flatMap((row) =>
    row.cover_photo_path ? [row.cover_photo_path] : [],
  )
  try {
    return await createSignedReviewImageUrls(paths)
  } catch {
    return new Map<string, string>()
  }
}

export async function loadRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await getSupabaseClient().rpc(
    'list_restaurants_with_review_stats',
  )

  if (error) {
    throw new Error('음식점 목록을 불러오지 못했습니다.')
  }

  const rows = (data ?? []) as RestaurantRow[]
  const signedUrls = await signedCoverUrls(rows)
  return rows.map((row) => toRestaurant(row, signedUrls))
}

export async function loadRestaurant(
  restaurantId: string,
): Promise<Restaurant | null> {
  const { data, error } = await getSupabaseClient()
    .rpc('get_restaurant_with_review_stats', {
      p_restaurant_id: restaurantId,
    })
    .maybeSingle()

  if (error) {
    throw new Error('음식점 정보를 불러오지 못했습니다.')
  }
  if (!data) return null

  const row = data as RestaurantRow
  const signedUrls = await signedCoverUrls([row])
  return toRestaurant(row, signedUrls)
}
