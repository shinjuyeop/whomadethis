import type { ActivityReview, ReviewPhoto } from '../types/database'
import { createSignedReviewImageUrls } from './reviewImages'

export interface ActivityReviewPhotoRow {
  id: string
  review_id: string
  storage_path: string
  sort_order: number
}

export interface ActivityReviewRow {
  id: string
  restaurant_id: string
  restaurant_name: string
  restaurant_category: string | null
  restaurant_address: string | null
  restaurant_road_address: string | null
  user_id: string
  author_nickname: string
  rating: number
  content: string | null
  visited_at: string
  created_at: string
  updated_at: string
  photos: ActivityReviewPhotoRow[]
  total_count: number
}

export interface ActivityReviewPage {
  items: ActivityReview[]
  totalCount: number
}

function toPhoto(
  row: ActivityReviewPhotoRow,
  signedUrls: Map<string, string>,
): ReviewPhoto {
  return {
    id: row.id,
    reviewId: row.review_id,
    storagePath: row.storage_path,
    sortOrder: row.sort_order,
    signedUrl: signedUrls.get(row.storage_path) ?? null,
  }
}

export async function hydrateActivityReviewRows(
  rows: ActivityReviewRow[],
): Promise<ActivityReviewPage> {
  const paths = rows.flatMap((row) =>
    Array.isArray(row.photos)
      ? row.photos.map((photo) => photo.storage_path)
      : [],
  )
  let signedUrls = new Map<string, string>()
  try {
    signedUrls = await createSignedReviewImageUrls(paths)
  } catch {
    // Reviews remain useful when a signed photo URL is temporarily unavailable.
  }

  return {
    totalCount: rows.length > 0 ? Number(rows[0].total_count) : 0,
    items: rows.map((row) => ({
      id: row.id,
      restaurantId: row.restaurant_id,
      userId: row.user_id,
      authorNickname: row.author_nickname,
      rating: Number(row.rating),
      content: row.content,
      visitedAt: row.visited_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      photos: (Array.isArray(row.photos) ? row.photos : [])
        .map((photo) => toPhoto(photo, signedUrls))
        .sort((left, right) => left.sortOrder - right.sortOrder),
      restaurant: {
        id: row.restaurant_id,
        name: row.restaurant_name,
        category: row.restaurant_category,
        address: row.restaurant_address,
        roadAddress: row.restaurant_road_address,
      },
    })),
  }
}
