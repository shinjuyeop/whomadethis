import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from './AppIcon'

export interface PhotoViewerItem {
  url: string
  alt: string
}

interface PhotoViewerProps {
  photos: PhotoViewerItem[]
  initialIndex: number
  onClose: () => void
}

export function PhotoViewer({
  photos,
  initialIndex,
  onClose,
}: PhotoViewerProps) {
  const [index, setIndex] = useState(
    Math.min(Math.max(initialIndex, 0), photos.length - 1),
  )
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const touchStartXRef = useRef<number | null>(null)
  const currentPhoto = photos[index]

  useEffect(() => {
    const previousActiveElement = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') {
        setIndex((current) => (current - 1 + photos.length) % photos.length)
      }
      if (event.key === 'ArrowRight') {
        setIndex((current) => (current + 1) % photos.length)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus()
      }
    }
  }, [onClose, photos.length])

  if (!currentPhoto) return null

  function move(offset: number) {
    setIndex((current) => (current + offset + photos.length) % photos.length)
  }

  return createPortal(
    <div
      className="photo-viewer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="photo-viewer"
        role="dialog"
        aria-modal="true"
        aria-label="사진 크게 보기"
        onTouchStart={(event) => {
          touchStartXRef.current = event.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(event) => {
          const startX = touchStartXRef.current
          const endX = event.changedTouches[0]?.clientX
          touchStartXRef.current = null
          if (startX === null || endX === undefined || photos.length < 2) return
          const distance = endX - startX
          if (Math.abs(distance) >= 48) move(distance > 0 ? -1 : 1)
        }}
      >
        <header className="photo-viewer-header">
          <span aria-live="polite">
            {index + 1} / {photos.length}
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="사진 크게 보기 닫기"
          >
            <AppIcon name="x" />
          </button>
        </header>

        <div className="photo-viewer-stage">
          {photos.length > 1 && (
            <button
              type="button"
              className="photo-viewer-arrow photo-viewer-arrow--previous"
              onClick={() => move(-1)}
              aria-label="이전 사진"
            >
              <AppIcon name="arrow" />
            </button>
          )}
          <img src={currentPhoto.url} alt={currentPhoto.alt} />
          {photos.length > 1 && (
            <button
              type="button"
              className="photo-viewer-arrow photo-viewer-arrow--next"
              onClick={() => move(1)}
              aria-label="다음 사진"
            >
              <AppIcon name="arrow" />
            </button>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}
