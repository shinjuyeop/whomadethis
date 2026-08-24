interface FullScreenStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function FullScreenState({
  title,
  description,
  actionLabel,
  onAction,
}: FullScreenStateProps) {
  return (
    <main className="full-screen-state">
      <span className="brand-mark" aria-hidden="true">
        w
      </span>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {actionLabel && onAction && (
        <button type="button" className="primary-button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </main>
  )
}
