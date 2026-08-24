import {
  hydrateActivityReviewRows,
  type ActivityReviewPage,
  type ActivityReviewRow,
} from './activityReviews'
import { getSupabaseClient } from './supabase'

export const FEED_PAGE_SIZE = 20

export async function loadRecentReviewPage(
  limit = FEED_PAGE_SIZE,
  offset = 0,
): Promise<ActivityReviewPage> {
  const { data, error } = await getSupabaseClient().rpc(
    'list_recent_reviews',
    { p_limit: limit, p_offset: offset },
  )
  if (error) {
    throw new Error('최근 기록을 불러오지 못했습니다.')
  }

  return hydrateActivityReviewRows((data ?? []) as ActivityReviewRow[])
}
