import type { ReviewPhoto } from '../types/database'
import { getSupabaseClient } from './supabase'

export const MAX_REVIEW_PHOTOS = 5
const MAX_SOURCE_FILE_SIZE = 25 * 1024 * 1024
const MAX_IMAGE_EDGE = 1600
const WEBP_QUALITY = 0.82
const REVIEW_IMAGE_BUCKET = 'review-images'
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

export interface ImageUploadProgress {
  phase: 'processing' | 'uploading'
  current: number
  total: number
}

export interface ImageUploadResult {
  uploadedCount: number
  failedCount: number
}

export class ReviewImageError extends Error {}

export function validateReviewImageFiles(files: File[]): void {
  if (files.length > MAX_REVIEW_PHOTOS) {
    throw new ReviewImageError(
      `사진은 방문 기록당 최대 ${MAX_REVIEW_PHOTOS}장까지 올릴 수 있습니다.`,
    )
  }

  for (const file of files) {
    const lowerName = file.name.toLowerCase()
    if (lowerName.endsWith('.heic') || lowerName.endsWith('.heif')) {
      throw new ReviewImageError(
        'HEIC 사진은 아직 지원하지 않습니다. JPG, PNG 또는 WebP로 변환해 주세요.',
      )
    }

    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      throw new ReviewImageError(
        'JPG, PNG, WebP 형식의 사진만 선택할 수 있습니다.',
      )
    }

    if (file.size > MAX_SOURCE_FILE_SIZE) {
      throw new ReviewImageError('사진 한 장의 크기는 25MB 이하여야 합니다.')
    }
  }
}

async function loadImage(file: File): Promise<{
  source: CanvasImageSource
  width: number
  height: number
  cleanup: () => void
}> {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    })
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    }
  }

  const objectUrl = URL.createObjectURL(file)
  const image = new Image()
  image.decoding = 'async'
  image.src = objectUrl
  await image.decode()
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  }
}

async function preprocessImage(file: File): Promise<Blob> {
  let loadedImage: Awaited<ReturnType<typeof loadImage>>
  try {
    loadedImage = await loadImage(file)
  } catch {
    throw new ReviewImageError(
      `${file.name} 사진을 읽지 못했습니다. 지원되는 이미지인지 확인해 주세요.`,
    )
  }

  try {
    if (loadedImage.width <= 0 || loadedImage.height <= 0) {
      throw new ReviewImageError(`${file.name} 사진의 크기를 확인하지 못했습니다.`)
    }

    const scale = Math.min(
      1,
      MAX_IMAGE_EDGE / Math.max(loadedImage.width, loadedImage.height),
    )
    const width = Math.max(1, Math.round(loadedImage.width * scale))
    const height = Math.max(1, Math.round(loadedImage.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new ReviewImageError('사진을 준비하지 못했습니다.')
    }

    context.drawImage(loadedImage.source, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY)
    })
    if (!blob) {
      throw new ReviewImageError('사진을 WebP 형식으로 변환하지 못했습니다.')
    }

    return blob
  } finally {
    loadedImage.cleanup()
  }
}

function availableSortOrders(occupiedSortOrders: number[]): number[] {
  const occupied = new Set(occupiedSortOrders)
  return Array.from({ length: MAX_REVIEW_PHOTOS }, (_, index) => index).filter(
    (index) => !occupied.has(index),
  )
}

export async function uploadReviewImages(
  userId: string,
  reviewId: string,
  files: File[],
  occupiedSortOrders: number[],
  onProgress?: (progress: ImageUploadProgress) => void,
): Promise<ImageUploadResult> {
  validateReviewImageFiles(files)
  const sortOrders = availableSortOrders(occupiedSortOrders)
  if (files.length > sortOrders.length) {
    throw new ReviewImageError(
      `기존 사진을 포함해 최대 ${MAX_REVIEW_PHOTOS}장까지 올릴 수 있습니다.`,
    )
  }

  let uploadedCount = 0
  let failedCount = 0

  for (const [index, file] of files.entries()) {
    let storagePath: string | null = null
    try {
      onProgress?.({ phase: 'processing', current: index + 1, total: files.length })
      const webp = await preprocessImage(file)
      storagePath = `${userId}/${reviewId}/${crypto.randomUUID()}.webp`
      onProgress?.({ phase: 'uploading', current: index + 1, total: files.length })

      const { error: uploadError } = await getSupabaseClient()
        .storage.from(REVIEW_IMAGE_BUCKET)
        .upload(storagePath, webp, {
          cacheControl: '3600',
          contentType: 'image/webp',
          upsert: false,
        })
      if (uploadError) throw new ReviewImageError('사진 업로드에 실패했습니다.')

      const { error: metadataError } = await getSupabaseClient()
        .from('review_photos')
        .insert({
          review_id: reviewId,
          storage_path: storagePath,
          sort_order: sortOrders[index],
        })
      if (metadataError) {
        await getSupabaseClient().storage.from(REVIEW_IMAGE_BUCKET).remove([
          storagePath,
        ])
        storagePath = null
        throw new ReviewImageError('사진 정보를 저장하지 못했습니다.')
      }

      uploadedCount += 1
    } catch {
      if (storagePath) {
        await getSupabaseClient().storage.from(REVIEW_IMAGE_BUCKET).remove([
          storagePath,
        ])
      }
      failedCount += 1
    }
  }

  return { uploadedCount, failedCount }
}

export async function removeReviewImages(photos: ReviewPhoto[]): Promise<void> {
  if (photos.length === 0) return

  const { error: storageError } = await getSupabaseClient()
    .storage.from(REVIEW_IMAGE_BUCKET)
    .remove(photos.map((photo) => photo.storagePath))
  if (storageError) {
    throw new ReviewImageError(
      '사진을 삭제하지 못했습니다. 기록은 그대로 유지했습니다.',
    )
  }

  const { error: metadataError } = await getSupabaseClient()
    .from('review_photos')
    .delete()
    .in(
      'id',
      photos.map((photo) => photo.id),
    )
  if (metadataError) {
    throw new ReviewImageError('사진 정보를 정리하지 못했습니다.')
  }
}

export async function createSignedReviewImageUrls(
  paths: string[],
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map()

  const { data, error } = await getSupabaseClient()
    .storage.from(REVIEW_IMAGE_BUCKET)
    .createSignedUrls(paths, 60 * 60)
  if (error || !data) {
    throw new ReviewImageError('방문 사진을 불러오지 못했습니다.')
  }

  const urls = new Map<string, string>()
  data.forEach((item, index) => {
    if (item.signedUrl) urls.set(paths[index], item.signedUrl)
  })
  return urls
}
