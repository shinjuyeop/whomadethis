import { Link } from 'react-router-dom'
import { formatRelativeTime, formatVisitedDate } from '../lib/date'
import type { ActivityReview } from '../types/database'

interface ActivityReviewItemProps {
  review: ActivityReview
  compact?: boolean
}

export function ActivityReviewItem({
  review,
  compact = false,
}: ActivityReviewItemProps) {
  const visiblePhotos = review.photos.filter((photo) => photo.signedUrl)

  return (
    <article className={`activity-item${compact ? ' activity-item--compact' : ''}`}>
      <header className="activity-heading">
        {!compact && <strong>{review.authorNickname}</strong>}
        <div>
          <Link to={`/restaurants/${review.restaurant.id}`}>
            {review.restaurant.name}
          </Link>
          <span>★ {review.rating.toFixed(1)}</span>
        </div>
      </header>

      {visiblePhotos.length > 0 && (
        <div className={`activity-photos activity-photos--${Math.min(visiblePhotos.length, 2)}`}>
          {visiblePhotos.map((photo, index) => (
            <a
              key={photo.id}
              href={photo.signedUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              aria-label={`${review.restaurant.name} 방문 사진 ${index + 1} 크게 보기`}
            >
              <img
                src={photo.signedUrl ?? undefined}
                alt={`${review.restaurant.name} 방문 사진 ${index + 1}`}
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}

      {review.content && <p className="activity-content">{review.content}</p>}
      <p className="activity-meta">
        <time dateTime={review.visitedAt}>{formatVisitedDate(review.visitedAt)} 방문</time>
        {!compact && (
          <>
            <span aria-hidden="true">·</span>
            <time dateTime={review.createdAt}>{formatRelativeTime(review.createdAt)} 기록</time>
          </>
        )}
      </p>
    </article>
  )
}
