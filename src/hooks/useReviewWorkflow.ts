import { useState } from 'react'
import type { ReviewEditorSubmission } from '../components/ReviewEditor'
import {
  removeReviewImages,
  ReviewImageError,
  uploadReviewImages,
  type ImageUploadProgress,
} from '../lib/reviewImages'
import { createVisitReview, updateReview } from '../lib/reviews'
import type { Restaurant, Review } from '../types/database'
import type { RestaurantSearchResult } from '../types/naverSearch'

interface ReviewEditorState {
  target: RestaurantSearchResult
  review?: Review
}

interface ReviewSavedResult {
  restaurantId: string
  message: string
}

interface UseReviewWorkflowOptions {
  userId: string
  onSaved: (result: ReviewSavedResult) => Promise<void> | void
}

export function restaurantToSearchResult(
  restaurant: Restaurant,
): RestaurantSearchResult {
  return {
    title: restaurant.name,
    category: restaurant.category,
    address: restaurant.address,
    roadAddress: restaurant.roadAddress,
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
    link: restaurant.naverLink,
  }
}

export function useReviewWorkflow({
  userId,
  onSaved,
}: UseReviewWorkflowOptions) {
  const [editor, setEditor] = useState<ReviewEditorState | null>(null)

  function openNew(target: RestaurantSearchResult) {
    setEditor({ target })
  }

  function openEdit(restaurant: Restaurant, review: Review) {
    setEditor({ target: restaurantToSearchResult(restaurant), review })
  }

  async function handleCreate(
    submission: ReviewEditorSubmission,
    onProgress: (progress: ImageUploadProgress) => void,
  ) {
    if (!editor) return
    const created = await createVisitReview(editor.target, submission.fields)
    const warnings: string[] = []

    if (submission.newFiles.length > 0) {
      try {
        const result = await uploadReviewImages(
          userId,
          created.reviewId,
          submission.newFiles,
          [],
          onProgress,
        )
        if (result.failedCount > 0) {
          warnings.push(`사진 ${result.failedCount}장을 올리지 못했어요.`)
        }
      } catch {
        warnings.push('사진을 올리지 못했어요.')
      }
    }

    await onSaved({
      restaurantId: created.restaurantId,
      message:
        warnings.length > 0
          ? `방문 기록은 저장됐습니다. ${warnings.join(' ')}`
          : '방문 기록을 저장했습니다.',
    })
    setEditor(null)
  }

  async function handleUpdate(
    submission: ReviewEditorSubmission,
    onProgress: (progress: ImageUploadProgress) => void,
  ) {
    if (!editor?.review) return
    const review = editor.review
    await updateReview(review.id, submission.fields)
    const warnings: string[] = []
    let remainingPhotos = review.photos
    let canUpload = true

    if (submission.removedPhotos.length > 0) {
      try {
        await removeReviewImages(submission.removedPhotos)
        const removedIds = new Set(
          submission.removedPhotos.map((photo) => photo.id),
        )
        remainingPhotos = review.photos.filter(
          (photo) => !removedIds.has(photo.id),
        )
      } catch (error) {
        canUpload = false
        warnings.push(
          error instanceof ReviewImageError
            ? error.message
            : '선택한 사진을 정리하지 못했습니다.',
        )
      }
    }

    if (submission.newFiles.length > 0) {
      if (!canUpload) {
        warnings.push('사진 삭제를 해결한 뒤 새 사진을 추가해 주세요.')
      } else {
        try {
          const result = await uploadReviewImages(
            userId,
            review.id,
            submission.newFiles,
            remainingPhotos.map((photo) => photo.sortOrder),
            onProgress,
          )
          if (result.failedCount > 0) {
            warnings.push(`사진 ${result.failedCount}장을 올리지 못했어요.`)
          }
        } catch {
          warnings.push('새 사진을 올리지 못했어요.')
        }
      }
    }

    await onSaved({
      restaurantId: review.restaurantId,
      message:
        warnings.length > 0
          ? `방문 기록은 수정됐습니다. ${warnings.join(' ')}`
          : '방문 기록을 수정했습니다.',
    })
    setEditor(null)
  }

  return {
    editor,
    openNew,
    openEdit,
    closeEditor: () => setEditor(null),
    submit: editor?.review ? handleUpdate : handleCreate,
  }
}
