const ROAD_ADDRESS_PATTERN = /(?:대로|로|길)\s*\d+(?:-\d+)?(?=\s|$)/
const LOT_ADDRESS_PATTERN = /(?:동|리|가|읍|면)\s*\d+(?:-\d+)?(?=\s|$)/

export function isLikelyKoreanAddress(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized || !/\d/.test(normalized)) return false

  return (
    ROAD_ADDRESS_PATTERN.test(normalized) || LOT_ADDRESS_PATTERN.test(normalized)
  )
}

export function isLikelyRoadAddress(value: string) {
  return ROAD_ADDRESS_PATTERN.test(value.trim().replace(/\s+/g, ' '))
}
