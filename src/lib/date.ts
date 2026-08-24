const KOREAN_DATE = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
})

export function formatVisitedDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : KOREAN_DATE.format(date)
}

export function formatRelativeTime(value: string) {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  )

  if (elapsedSeconds < 60) return '방금 전'
  const minutes = Math.floor(elapsedSeconds / 60)
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`

  return KOREAN_DATE.format(new Date(value))
}
