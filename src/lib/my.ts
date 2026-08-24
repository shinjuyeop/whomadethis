import type { MyReviewStats } from '../types/database'
import {
  hydrateActivityReviewRows,
  type ActivityReviewPage,
  type ActivityReviewRow,
} from './activityReviews'
import { getSupabaseClient } from './supabase'

interface MyReviewStatsRow {
  visited_restaurant_count: number
  review_count: number
  photo_count: number
  average_rating: number | null
}

export const MY_REVIEW_PAGE_SIZE = 20

export async function loadMyReviewStats(): Promise<MyReviewStats> {
  const { data, error } = await getSupabaseClient()
    .rpc('get_my_review_stats')
    .single()
  if (error || !data) {
    throw new Error('내 방문 통계를 불러오지 못했습니다.')
  }

  const row = data as MyReviewStatsRow
  return {
    visitedRestaurantCount: Number(row.visited_restaurant_count),
    reviewCount: Number(row.review_count),
    photoCount: Number(row.photo_count),
    averageRating:
      row.average_rating === null ? null : Number(row.average_rating),
  }
}

export async function loadMyReviewPage(
  limit = MY_REVIEW_PAGE_SIZE,
  offset = 0,
): Promise<ActivityReviewPage> {
  const { data, error } = await getSupabaseClient().rpc('list_my_reviews', {
    p_limit: limit,
    p_offset: offset,
  })
  if (error) {
    throw new Error('내 방문 기록을 불러오지 못했습니다.')
  }

  return hydrateActivityReviewRows((data ?? []) as ActivityReviewRow[])
}
