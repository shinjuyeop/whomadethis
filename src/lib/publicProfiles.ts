import type { MyReviewStats } from '../types/database'
import {
  hydrateActivityReviewRows,
  type ActivityReviewPage,
  type ActivityReviewRow,
} from './activityReviews'
import { loadProfile } from './profiles'
import { getSupabaseClient } from './supabase'

interface UserReviewStatsRow {
  visited_restaurant_count: number
  review_count: number
  photo_count: number
  average_rating: number | null
}

interface UserRestaurantRow {
  restaurant_id: string
}

export const PUBLIC_PROFILE_PAGE_SIZE = 20

export { loadProfile as loadPublicProfile }

export async function loadUserReviewStats(
  userId: string,
): Promise<MyReviewStats> {
  const { data, error } = await getSupabaseClient()
    .rpc('get_user_review_stats', { p_user_id: userId })
    .single()
  if (error || !data) {
    throw new Error('프로필 통계를 불러오지 못했습니다.')
  }

  const row = data as UserReviewStatsRow
  return {
    visitedRestaurantCount: Number(row.visited_restaurant_count),
    reviewCount: Number(row.review_count),
    photoCount: Number(row.photo_count),
    averageRating:
      row.average_rating === null ? null : Number(row.average_rating),
  }
}

export async function loadUserReviewPage(
  userId: string,
  limit = PUBLIC_PROFILE_PAGE_SIZE,
  offset = 0,
): Promise<ActivityReviewPage> {
  const { data, error } = await getSupabaseClient().rpc('list_user_reviews', {
    p_user_id: userId,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) {
    throw new Error('프로필 후기를 불러오지 못했습니다.')
  }

  return hydrateActivityReviewRows((data ?? []) as ActivityReviewRow[])
}

export async function loadUserRestaurantIds(userId: string): Promise<string[]> {
  const { data, error } = await getSupabaseClient().rpc(
    'list_user_restaurant_ids',
    { p_user_id: userId },
  )
  if (error) {
    throw new Error('작성자의 지도 기록을 불러오지 못했습니다.')
  }

  return ((data ?? []) as UserRestaurantRow[]).map((row) => row.restaurant_id)
}
