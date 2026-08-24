import type { ReviewPhoto } from '../types/database'
import { getSupabaseClient } from './supabase'

export const MAX_REVIEW_PHOTOS = 5
const MAX_SOURCE_FILE_SIZE = 25 * 1024 * 1024
const MAX_IMAGE_EDGE = 1440
const WEBP_QUALITY = 0.78
const JPEG_QUALITY = 0.82
const REVIEW_IMAGE_BUCKET = 'review-images'

interface PreparedImage {
  blob: Blob
  extension: 'webp' | 'jpg' | 'png'
  contentType: 'image/webp' | 'image/jpeg' | 'image/png'
}

export interface ImageUploadProgress {
  phase: 'processing' | 'uploading'
  current: number
  total: number
}

export interface ImageUploadResult {
  uploadedCount: number
}

export class ReviewImageError extends Error {}

export function validateReviewImageFiles(files: File[]): void {
  if (files.length > MAX_REVIEW_PHOTOS) {
    throw new ReviewImageError(
      `사진은 방문 기록당 최대 ${MAX_REVIEW_PHOTOS}장까지 올릴 수 있습니다.`,
    )
  }

  for (const file of files) {
    const mimeType = file.type.toLowerCase()
    if (mimeType === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      throw new ReviewImageError(
        'SVG 파일은 사진으로 올릴 수 없습니다.',
      )
    }

    if (mimeType && !mimeType.startsWith('image/')) {
      throw new ReviewImageError(
        '사진 파일만 선택할 수 있습니다.',
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
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
      })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      }
    } catch {
      // Safari can display some camera formats through <img> even when
      // createImageBitmap cannot decode them, so continue with the fallback.
    }
  }

  const objectUrl = URL.createObjectURL(file)
  const image = new Image()
  image.decoding = 'async'
  image.src = objectUrl
  try {
    await image.decode()
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  }
}

async function detectEncodedImage(blob: Blob): Promise<PreparedImage | null> {
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer())
  const isWebp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  if (isWebp) {
    return {
      blob: new Blob([blob], { type: 'image/webp' }),
      extension: 'webp',
      contentType: 'image/webp',
    }
  }

  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  if (isJpeg) {
    return {
      blob: new Blob([blob], { type: 'image/jpeg' }),
      extension: 'jpg',
      contentType: 'image/jpeg',
    }
  }

  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  if (isPng) {
    return {
      blob: new Blob([blob], { type: 'image/png' }),
      extension: 'png',
      contentType: 'image/png',
    }
  }

  return null
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

async function preprocessImage(file: File): Promise<PreparedImage> {
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

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(loadedImage.source, 0, 0, width, height)

    const webpBlob = await encodeCanvas(canvas, 'image/webp', WEBP_QUALITY)
    const webpResult = webpBlob
      ? await detectEncodedImage(webpBlob)
      : null
    if (webpResult?.contentType === 'image/webp') return webpResult

    const jpegBlob = await encodeCanvas(canvas, 'image/jpeg', JPEG_QUALITY)
    const jpegResult = jpegBlob
      ? await detectEncodedImage(jpegBlob)
      : null
    if (jpegResult?.contentType === 'image/jpeg') return jpegResult

    // PNG export is required by the canvas specification and gives older or
    // partially implemented mobile browsers one final, reliable fallback.
    const pngBlob = await encodeCanvas(canvas, 'image/png')
    const pngResult = pngBlob ? await detectEncodedImage(pngBlob) : null

    if (webpResult) return webpResult
    if (jpegResult) return jpegResult
    if (pngResult) return pngResult
    throw new ReviewImageError(
      '사진을 압축하지 못했습니다. 다른 사진으로 다시 시도해 주세요.',
    )
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

  const uploadedPhotos: ReviewPhoto[] = []

  for (const [index, file] of files.entries()) {
    let storagePath: string | null = null
    try {
      onProgress?.({ phase: 'processing', current: index + 1, total: files.length })
      const prepared = await preprocessImage(file)
      storagePath = `${userId}/${reviewId}/${crypto.randomUUID()}.${prepared.extension}`
      onProgress?.({ phase: 'uploading', current: index + 1, total: files.length })

      const { error: uploadError } = await getSupabaseClient()
        .storage.from(REVIEW_IMAGE_BUCKET)
        .upload(storagePath, prepared.blob, {
          cacheControl: '3600',
          contentType: prepared.contentType,
          upsert: false,
        })
      if (uploadError) throw new ReviewImageError('사진 업로드에 실패했습니다.')

      const { data: metadata, error: metadataError } = await getSupabaseClient()
        .from('review_photos')
        .insert({
          review_id: reviewId,
          storage_path: storagePath,
          sort_order: sortOrders[index],
        })
        .select('id, review_id, storage_path, sort_order')
        .single()
      if (metadataError || !metadata) {
        await getSupabaseClient().storage.from(REVIEW_IMAGE_BUCKET).remove([
          storagePath,
        ])
        storagePath = null
        throw new ReviewImageError('사진 정보를 저장하지 못했습니다.')
      }

      uploadedPhotos.push({
        id: metadata.id,
        reviewId: metadata.review_id,
        storagePath: metadata.storage_path,
        sortOrder: metadata.sort_order,
        signedUrl: null,
      })
    } catch (error) {
      if (storagePath) {
        await getSupabaseClient().storage.from(REVIEW_IMAGE_BUCKET).remove([
          storagePath,
        ])
      }
      if (uploadedPhotos.length > 0) {
        try {
          await removeReviewImages(uploadedPhotos)
        } catch {
          // The original upload error is more useful to the user.
        }
      }
      throw new ReviewImageError(
        error instanceof ReviewImageError
          ? `${file.name}: ${error.message}`
          : `${file.name} 사진을 올리지 못했습니다. 다시 시도해 주세요.`,
      )
    }
  }

  return { uploadedCount: uploadedPhotos.length }
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

  const uniquePaths = [...new Set(paths)]
  const { data, error } = await getSupabaseClient()
    .storage.from(REVIEW_IMAGE_BUCKET)
    .createSignedUrls(uniquePaths, 60 * 60)
  if (error || !data) {
    throw new ReviewImageError('방문 사진을 불러오지 못했습니다.')
  }

  const urls = new Map<string, string>()
  data.forEach((item) => {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl)
  })
  return urls
}
