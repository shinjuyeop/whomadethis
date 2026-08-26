import { useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { formatRelativeTime, formatVisitedDate } from '../lib/date'
import type { ActivityReview } from '../types/database'
import { PhotoViewer } from './PhotoViewer'

interface ActivityReviewItemProps {
  review: ActivityReview
  compact?: boolean
  hideAuthor?: boolean
  onEdit?: () => void
}

export function ActivityReviewItem({
  review,
  compact = false,
  hideAuthor = false,
  onEdit,
}: ActivityReviewItemProps) {
  const visiblePhotos = review.photos.filter((photo) => photo.signedUrl)
  const isEditable = Boolean(onEdit)
  const restaurantAddress =
    review.restaurant.roadAddress || review.restaurant.address
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const viewerPhotos = visiblePhotos.map((photo, index) => ({
    url: photo.signedUrl ?? '',
    alt: `${review.restaurant.name} 방문 사진 ${index + 1}`,
  }))

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!onEdit || (event.key !== 'Enter' && event.key !== ' ')) return
    if ((event.target as HTMLElement).closest('a, button')) return
    event.preventDefault()
    onEdit()
  }

  function handleClick(event: MouseEvent<HTMLElement>) {
    if (!onEdit || (event.target as HTMLElement).closest('a, button')) return
    onEdit()
  }

  return (
    <article
      className={`activity-item${compact ? ' activity-item--compact' : ''}${isEditable ? ' activity-item--editable' : ''}`}
      role={isEditable ? 'button' : undefined}
      tabIndex={isEditable ? 0 : undefined}
      aria-label={isEditable ? `${review.restaurant.name} 후기 수정` : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <header className="activity-heading">
        {!compact && !hideAuthor && (
          <div className="activity-author-row">
            <Link
              className="activity-author-link"
              to={`/profiles/${encodeURIComponent(review.userId)}`}
            >
              {review.authorNickname}
            </Link>
            <span aria-hidden="true">·</span>
            <time dateTime={review.createdAt}>
              {formatRelativeTime(review.createdAt)} 기록
            </time>
          </div>
        )}
        <div className="activity-restaurant-row">
          {isEditable ? (
            <span className="activity-restaurant-name">{review.restaurant.name}</span>
          ) : (
            <Link to={`/restaurants/${review.restaurant.id}`}>
              {review.restaurant.name}
            </Link>
          )}
          <span>★ {review.rating.toFixed(1)}</span>
        </div>
        {restaurantAddress && (
          <address className="activity-address">
            <Link to={`/?restaurant=${encodeURIComponent(review.restaurant.id)}`}>
              {restaurantAddress}
            </Link>
          </address>
        )}
      </header>

      {visiblePhotos.length > 0 && (
        <div className={`activity-photos activity-photos--${Math.min(visiblePhotos.length, 2)}`}>
          {visiblePhotos.map((photo, index) => (
            isEditable ? (
              <span className="activity-photo" key={photo.id}>
                <img
                  src={photo.signedUrl ?? undefined}
                  alt={`${review.restaurant.name} 방문 사진 ${index + 1}`}
                  loading="lazy"
                />
              </span>
            ) : (
              <button
                key={photo.id}
                type="button"
                className="activity-photo-button"
                onClick={() => setViewerIndex(index)}
                aria-label={`${review.restaurant.name} 방문 사진 ${index + 1} 크게 보기`}
              >
                <img
                  src={photo.signedUrl ?? undefined}
                  alt={`${review.restaurant.name} 방문 사진 ${index + 1}`}
                  loading="lazy"
                />
              </button>
            )
          ))}
        </div>
      )}

      {review.content && <p className="activity-content">{review.content}</p>}
      <p className="activity-meta">
        <time dateTime={review.visitedAt}>{formatVisitedDate(review.visitedAt)} 방문</time>
        {isEditable && <span className="activity-edit-label">후기 수정</span>}
      </p>

      {viewerIndex !== null && (
        <PhotoViewer
          photos={viewerPhotos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </article>
  )
}
