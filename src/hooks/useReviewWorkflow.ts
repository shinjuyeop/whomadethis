import { useState } from 'react'
import type { ReviewEditorSubmission } from '../components/ReviewEditor'
import {
  removeReviewImages,
  ReviewImageError,
  uploadReviewImages,
  type ImageUploadProgress,
} from '../lib/reviewImages'
import {
  createVisitReview,
  loadReviewPhotos,
  updateReview,
} from '../lib/reviews'
import type { ActivityReview, Restaurant, Review } from '../types/database'
import type { RestaurantSearchResult } from '../types/naverSearch'

interface ReviewEditorState {
  target: RestaurantSearchResult
  review?: Review
  isManualLocation?: boolean
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

  function openManual(target: RestaurantSearchResult) {
    setEditor({ target, isManualLocation: true })
  }

  function openEdit(restaurant: Restaurant, review: Review) {
    setEditor({ target: restaurantToSearchResult(restaurant), review })
  }

  function openActivityEdit(review: ActivityReview) {
    setEditor({
      target: {
        title: review.restaurant.name,
        category: review.restaurant.category,
        address: review.restaurant.address,
        roadAddress: review.restaurant.roadAddress,
        latitude: null,
        longitude: null,
        link: null,
      },
      review,
    })
  }

  async function handleCreate(
    submission: ReviewEditorSubmission,
    onProgress: (progress: ImageUploadProgress) => void,
  ) {
    if (!editor) return
    const target = editor.isManualLocation
      ? {
          ...editor.target,
          title: submission.restaurantName?.trim() ?? '',
        }
      : editor.target
    const created = await createVisitReview(target, submission.fields)

    if (submission.newFiles.length > 0) {
      try {
        const existingPhotos = await loadReviewPhotos(created.reviewId)
        await uploadReviewImages(
          userId,
          created.reviewId,
          submission.newFiles,
          existingPhotos.map((photo) => photo.sortOrder),
          onProgress,
        )
      } catch (error) {
        throw new ReviewImageError(
          error instanceof ReviewImageError
            ? `후기는 저장됐지만 ${error.message}`
            : '후기는 저장됐지만 사진을 올리지 못했습니다. 다시 시도해 주세요.',
        )
      }
    }

    await onSaved({
      restaurantId: created.restaurantId,
      message: '후기를 저장했습니다.',
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
          await uploadReviewImages(
            userId,
            review.id,
            submission.newFiles,
            remainingPhotos.map((photo) => photo.sortOrder),
            onProgress,
          )
        } catch (error) {
          warnings.push(
            error instanceof ReviewImageError
              ? error.message
              : '새 사진을 올리지 못했어요.',
          )
        }
      }
    }

    await onSaved({
      restaurantId: review.restaurantId,
      message:
        warnings.length > 0
          ? `후기는 수정됐습니다. ${warnings.join(' ')}`
          : '후기를 수정했습니다.',
    })
    setEditor(null)
  }

  return {
    editor,
    openNew,
    openManual,
    openEdit,
    openActivityEdit,
    closeEditor: () => setEditor(null),
    submit: editor?.review ? handleUpdate : handleCreate,
  }
}
