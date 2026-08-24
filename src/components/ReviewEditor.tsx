import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  MAX_REVIEW_PHOTOS,
  ReviewImageError,
  type ImageUploadProgress,
  validateReviewImageFiles,
} from '../lib/reviewImages'
import { RestaurantSelectionError } from '../lib/restaurants'
import { ReviewMutationError, type ReviewFields } from '../lib/reviews'
import type { Review, ReviewPhoto } from '../types/database'

export interface ReviewEditorSubmission {
  fields: ReviewFields
  newFiles: File[]
  removedPhotos: ReviewPhoto[]
}

interface ReviewEditorProps {
  restaurantName: string
  restaurantAddress: string | null
  review?: Review
  onSubmit: (
    submission: ReviewEditorSubmission,
    onProgress: (progress: ImageUploadProgress) => void,
  ) => Promise<void>
  onClose: () => void
}

function today(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function progressLabel(progress: ImageUploadProgress | null): string {
  if (!progress) return '저장 중…'
  return progress.phase === 'processing'
    ? `사진 준비 중… ${progress.current}/${progress.total}`
    : `사진 올리는 중… ${progress.current}/${progress.total}`
}

export function ReviewEditor({
  restaurantName,
  restaurantAddress,
  review,
  onSubmit,
  onClose,
}: ReviewEditorProps) {
  const initialRating = review?.rating ?? 5
  const initialVisitedAt = review?.visitedAt ?? today()
  const initialContent = review?.content ?? ''
  const [rating, setRating] = useState(initialRating)
  const [visitedAt, setVisitedAt] = useState(initialVisitedAt)
  const [content, setContent] = useState(initialContent)
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [removedPhotoIds, setRemovedPhotoIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progress, setProgress] = useState<ImageUploadProgress | null>(null)
  const existingPhotos = review?.photos ?? []
  const newFilePreviews = useMemo(
    () =>
      newFiles.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      })),
    [newFiles],
  )
  const keptPhotoCount = existingPhotos.length - removedPhotoIds.size
  const totalPhotoCount = keptPhotoCount + newFiles.length
  const isDirty = useMemo(
    () =>
      rating !== initialRating ||
      visitedAt !== initialVisitedAt ||
      content !== initialContent ||
      newFiles.length > 0 ||
      removedPhotoIds.size > 0,
    [
      content,
      initialContent,
      initialRating,
      initialVisitedAt,
      newFiles.length,
      rating,
      removedPhotoIds.size,
      visitedAt,
    ],
  )

  function requestClose() {
    if (isSubmitting) return
    if (
      isDirty &&
      !window.confirm('작성 중인 내용이 있습니다. 후기 작성을 닫을까요?')
    ) {
      return
    }
    onClose()
  }

  useEffect(() => {
    return () => {
      newFilePreviews.forEach((preview) => URL.revokeObjectURL(preview.url))
    }
  }, [newFilePreviews])

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty || isSubmitting) return
      event.preventDefault()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') requestClose()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('keydown', handleKeyDown)
    }
  })

  function handleFiles(files: File[]) {
    try {
      const nextFiles = [...newFiles, ...files]
      validateReviewImageFiles(nextFiles)
      if (keptPhotoCount + nextFiles.length > MAX_REVIEW_PHOTOS) {
        throw new ReviewImageError(
          `기존 사진을 포함해 최대 ${MAX_REVIEW_PHOTOS}장까지 올릴 수 있습니다.`,
        )
      }
      setNewFiles(nextFiles)
      setMessage('')
    } catch (error) {
      setMessage(
        error instanceof ReviewImageError
          ? error.message
          : '사진을 선택하지 못했습니다.',
      )
    }
  }

  function toggleExistingPhoto(photoId: string) {
    setRemovedPhotoIds((current) => {
      const next = new Set(current)
      if (next.has(photoId)) next.delete(photoId)
      else next.add(photoId)
      return next
    })
    setMessage('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (totalPhotoCount > MAX_REVIEW_PHOTOS) {
      setMessage(`사진은 최대 ${MAX_REVIEW_PHOTOS}장까지 올릴 수 있습니다.`)
      return
    }

    setIsSubmitting(true)
    setProgress(null)
    setMessage('')
    try {
      await onSubmit(
        {
          fields: { rating, content, visitedAt },
          newFiles,
          removedPhotos: existingPhotos.filter((photo) =>
            removedPhotoIds.has(photo.id),
          ),
        },
        setProgress,
      )
    } catch (error) {
      setMessage(
        error instanceof ReviewMutationError ||
          error instanceof ReviewImageError ||
          error instanceof RestaurantSelectionError
          ? error.message
          : '방문 기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
      setIsSubmitting(false)
      setProgress(null)
    }
  }

  return (
    <div className="review-editor-backdrop">
      <section
        className="review-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-editor-title"
      >
        <header className="review-editor-header">
          <div>
            <p>{review ? '후기 수정' : '후기 남기기'}</p>
            <h2 id="review-editor-title">{restaurantName}</h2>
            {restaurantAddress && <address>{restaurantAddress}</address>}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={requestClose}
            disabled={isSubmitting}
            aria-label="후기 작성 닫기"
          >
            ×
          </button>
        </header>

        <form className="review-form" onSubmit={handleSubmit}>
          <div className="rating-field">
            <label htmlFor="review-rating">별점</label>
            <output htmlFor="review-rating">★ {rating.toFixed(1)}</output>
            <input
              id="review-rating"
              type="range"
              min="0.5"
              max="5"
              step="0.1"
              value={rating}
              onChange={(event) => setRating(Number(event.target.value))}
              disabled={isSubmitting}
            />
            <div className="rating-scale" aria-hidden="true">
              <span>0.5</span>
              <span>5.0</span>
            </div>
          </div>

          <label htmlFor="review-visited-at">방문 날짜</label>
          <input
            id="review-visited-at"
            type="date"
            value={visitedAt}
            max={today()}
            onChange={(event) => setVisitedAt(event.target.value)}
            disabled={isSubmitting}
            required
          />

          <label htmlFor="review-content">후기</label>
          <textarea
            id="review-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="어떤 점이 좋았나요? 비워 두어도 괜찮아요."
            maxLength={5000}
            rows={5}
            disabled={isSubmitting}
          />
          <small className="field-hint">{content.length.toLocaleString()} / 5,000</small>

          <div className="photo-field">
            <div className="photo-field-heading">
              <label htmlFor="review-photos">사진</label>
              <span>{totalPhotoCount} / {MAX_REVIEW_PHOTOS}</span>
            </div>

            {existingPhotos.length > 0 && (
              <ul className="photo-selection-list photo-selection-list--existing">
                {existingPhotos.map((photo) => {
                  const removed = removedPhotoIds.has(photo.id)
                  return (
                    <li key={photo.id} className={removed ? 'photo-marked-removed' : ''}>
                      {photo.signedUrl ? (
                        <img src={photo.signedUrl} alt="기존 방문 사진" />
                      ) : (
                        <span className="photo-placeholder">사진</span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleExistingPhoto(photo.id)}
                        disabled={isSubmitting}
                      >
                        {removed ? '되돌리기' : '삭제'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {newFiles.length > 0 && (
              <ul className="photo-selection-list photo-selection-list--new">
                {newFilePreviews.map(({ file, url }, index) => (
                  <li
                    key={`${file.name}-${file.lastModified}-${index}`}
                    title={file.name}
                  >
                    <img src={url} alt={`새로 선택한 사진 ${index + 1}`} />
                    <button
                      type="button"
                      onClick={() =>
                        setNewFiles((current) =>
                          current.filter((_, fileIndex) => fileIndex !== index),
                        )
                      }
                      disabled={isSubmitting}
                      aria-label={`${file.name} 선택 해제`}
                    >
                      제외
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <label className="photo-picker" htmlFor="review-photos">
              사진 선택
              <input
                id="review-photos"
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                onChange={(event) => {
                  handleFiles(Array.from(event.target.files ?? []))
                  event.target.value = ''
                }}
                disabled={isSubmitting || totalPhotoCount >= MAX_REVIEW_PHOTOS}
              />
            </label>
            <small className="field-hint">
              브라우저에서 열 수 있는 사진 · 긴 변 1440px WebP로 자동 압축
            </small>
          </div>

          {message && (
            <p className="form-message form-message--error" role="alert">
              {message}
            </p>
          )}

          <div className="review-form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={requestClose}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? progressLabel(progress) : review ? '수정하기' : '후기 저장'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
