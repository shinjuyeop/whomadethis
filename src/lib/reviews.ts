import type { RestaurantSearchResult } from '../types/naverSearch'
import type { Review, ReviewPhoto } from '../types/database'
import { resolveRestaurantCoordinates } from './restaurants'
import { createSignedReviewImageUrls, removeReviewImages } from './reviewImages'
import { getSupabaseClient } from './supabase'

interface CreateReviewRow {
  restaurant_id: string
  review_id: string
}

interface ReviewPhotoRow {
  id: string
  review_id: string
  storage_path: string
  sort_order: number
}

interface ReviewRow {
  id: string
  restaurant_id: string
  user_id: string
  author_nickname: string
  rating: number
  content: string | null
  visited_at: string
  created_at: string
  updated_at: string
  photos: ReviewPhotoRow[]
}

export interface ReviewFields {
  rating: number
  content: string
  visitedAt: string
}

export interface CreatedVisitReview {
  restaurantId: string
  reviewId: string
}

export class ReviewMutationError extends Error {}

function toPhoto(
  row: ReviewPhotoRow,
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

function validateReviewFields(fields: ReviewFields): void {
  const ratingInTenths = fields.rating * 10
  if (
    !Number.isFinite(fields.rating) ||
    fields.rating < 0.5 ||
    fields.rating > 5 ||
    Math.abs(ratingInTenths - Math.round(ratingInTenths)) > 1e-8
  ) {
    throw new ReviewMutationError('별점은 0.1점 단위로 선택해 주세요.')
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.visitedAt)) {
    throw new ReviewMutationError('방문 날짜를 확인해 주세요.')
  }

  if (fields.content.length > 5000) {
    throw new ReviewMutationError('후기는 5,000자 이하로 작성해 주세요.')
  }
}

export async function createVisitReview(
  restaurant: RestaurantSearchResult,
  fields: ReviewFields,
): Promise<CreatedVisitReview> {
  validateReviewFields(fields)
  const restaurantName = restaurant.title.trim()
  if (!restaurantName || restaurantName.length > 200) {
    throw new ReviewMutationError(
      '장소 이름은 1자 이상 200자 이하로 입력해 주세요.',
    )
  }
  if (!restaurant.roadAddress && !restaurant.address) {
    throw new ReviewMutationError('이 장소의 위치를 확인하지 못했습니다.')
  }

  const coordinates = await resolveRestaurantCoordinates(restaurant)
  const { data, error } = await getSupabaseClient()
    .rpc('create_visit_review', {
      p_name: restaurantName,
      p_category: restaurant.category,
      p_address: restaurant.address,
      p_road_address: restaurant.roadAddress,
      p_latitude: coordinates.latitude,
      p_longitude: coordinates.longitude,
      p_naver_link: restaurant.link,
      p_rating: fields.rating,
      p_content: fields.content,
      p_visited_at: fields.visitedAt,
    })
    .single()

  if (error || !data) {
    throw new ReviewMutationError(
      '방문 기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    )
  }

  const row = data as CreateReviewRow
  return { restaurantId: row.restaurant_id, reviewId: row.review_id }
}

export async function loadRestaurantReviews(
  restaurantId: string,
): Promise<Review[]> {
  const { data, error } = await getSupabaseClient().rpc(
    'list_restaurant_reviews',
    { p_restaurant_id: restaurantId },
  )
  if (error) {
    throw new Error('방문 기록을 불러오지 못했습니다.')
  }

  const rows = (data ?? []) as ReviewRow[]
  const paths = rows.flatMap((row) =>
    Array.isArray(row.photos)
      ? row.photos.map((photo) => photo.storage_path)
      : [],
  )
  let signedUrls = new Map<string, string>()
  try {
    signedUrls = await createSignedReviewImageUrls(paths)
  } catch {
    // Review text remains available if Storage signing is temporarily unavailable.
  }

  return rows.map((row) => ({
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
  }))
}

export async function loadReviewPhotos(reviewId: string): Promise<ReviewPhoto[]> {
  const { data, error } = await getSupabaseClient()
    .from('review_photos')
    .select('id, review_id, storage_path, sort_order')
    .eq('review_id', reviewId)
    .order('sort_order')
  if (error) {
    throw new ReviewMutationError('기존 사진 정보를 확인하지 못했습니다.')
  }

  const rows = (data ?? []) as ReviewPhotoRow[]
  let signedUrls = new Map<string, string>()
  try {
    signedUrls = await createSignedReviewImageUrls(
      rows.map((row) => row.storage_path),
    )
  } catch {
    // Sort order data is enough to safely append a photo.
  }
  return rows.map((row) => toPhoto(row, signedUrls))
}

export async function updateReview(
  reviewId: string,
  fields: ReviewFields,
): Promise<void> {
  validateReviewFields(fields)
  const { data, error } = await getSupabaseClient()
    .from('reviews')
    .update({
      rating: fields.rating,
      content: fields.content.trim() || null,
      visited_at: fields.visitedAt,
    })
    .eq('id', reviewId)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    throw new ReviewMutationError('방문 기록을 수정하지 못했습니다.')
  }
}

export async function deleteReview(review: Review): Promise<void> {
  await removeReviewImages(review.photos)

  const { data, error } = await getSupabaseClient()
    .from('reviews')
    .delete()
    .eq('id', review.id)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    throw new ReviewMutationError('방문 기록을 삭제하지 못했습니다.')
  }
}
