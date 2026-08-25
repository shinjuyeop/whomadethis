import type { MapCoordinate, MapViewport } from '../types/map'
import type { ReverseGeocodeResponse } from '../types/naverReverseGeocode'
import type {
  RestaurantSearchResponse,
  RestaurantSearchResult,
} from '../types/naverSearch'
import { distanceInMeters, isCoordinateInViewport } from './mapDistance'
import { resolveRestaurantCoordinates } from './restaurants'

const SEARCH_UNAVAILABLE_MESSAGE =
  '검색 서비스를 일시적으로 사용할 수 없습니다.'
const AREA_RESULT_LIMIT = 8
const LAZY_GEOCODE_LIMIT = 3
const reverseGeocodeCache = new Map<
  string,
  Promise<ReverseGeocodeResponse>
>()

export class SearchRequestError extends Error {}

function getServerErrorMessage(body: unknown): string | null {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('error' in body) ||
    typeof body.error !== 'object' ||
    body.error === null ||
    !('message' in body.error) ||
    typeof body.error.message !== 'string'
  ) {
    return null
  }
  return body.error.message.trim() || null
}

async function requestJson<T>(url: string, fallbackMessage: string): Promise<T> {
  try {
    const response = await fetch(url)
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new SearchRequestError(fallbackMessage)
    }
    if (!response.ok) {
      throw new SearchRequestError(
        getServerErrorMessage(body) ?? fallbackMessage,
      )
    }
    return body as T
  } catch (error) {
    if (error instanceof SearchRequestError) throw error
    throw new SearchRequestError(fallbackMessage)
  }
}

export function searchRestaurants(query: string) {
  return requestJson<RestaurantSearchResponse>(
    `/api/naver-search?q=${encodeURIComponent(query)}`,
    SEARCH_UNAVAILABLE_MESSAGE,
  )
}

function reverseGeocode(center: MapCoordinate) {
  const cacheKey = `${center.latitude.toFixed(4)},${center.longitude.toFixed(4)}`
  const cached = reverseGeocodeCache.get(cacheKey)
  if (cached) return cached

  const request = requestJson<ReverseGeocodeResponse>(
    `/api/naver-reverse-geocode?latitude=${encodeURIComponent(center.latitude)}&longitude=${encodeURIComponent(center.longitude)}`,
    '현재 지도 지역을 확인하지 못했습니다.',
  )
  reverseGeocodeCache.set(cacheKey, request)
  request.catch(() => reverseGeocodeCache.delete(cacheKey))
  return request
}

export function normalizeRestaurantIdentity(
  name: string,
  address: string | null,
) {
  const normalize = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, '')
  return `${normalize(name)}|${normalize(address ?? '')}`
}

function textRelevance(query: string, title: string) {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^0-9a-z가-힣]/g, '')
  const normalizedQuery = normalize(query)
  const normalizedTitle = normalize(title)
  if (!normalizedQuery || !normalizedTitle) return 0
  if (normalizedTitle === normalizedQuery) return 60
  if (normalizedTitle.startsWith(normalizedQuery)) return 52
  if (normalizedTitle.includes(normalizedQuery)) return 44

  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map(normalize)
    .filter(Boolean)
  return tokens.reduce(
    (score, token) => score + (normalizedTitle.includes(token) ? 10 : 0),
    0,
  )
}

interface RankedCandidate {
  item: RestaurantSearchResult
  apiScore: number
}

function mergeCandidates(
  genericItems: RestaurantSearchResult[],
  localizedResponses: RestaurantSearchResponse[],
) {
  const candidates = new Map<string, RankedCandidate>()
  const responses = [
    ...localizedResponses.map((response, index) => ({
      items: response.items,
      responseBonus: 24 - index * 3,
    })),
    { items: genericItems, responseBonus: 8 },
  ]

  for (const { items, responseBonus } of responses) {
    items.forEach((item, index) => {
      const key = normalizeRestaurantIdentity(
        item.title,
        item.roadAddress || item.address,
      )
      const apiScore = responseBonus + Math.max(0, 10 - index * 2)
      const existing = candidates.get(key)
      if (!existing || apiScore > existing.apiScore) {
        const hasCoordinates =
          item.latitude !== null && item.longitude !== null
        candidates.set(key, {
          item:
            !hasCoordinates &&
            existing &&
            existing.item.latitude !== null &&
            existing.item.longitude !== null
              ? {
                  ...item,
                  latitude: existing.item.latitude,
                  longitude: existing.item.longitude,
                }
              : item,
          apiScore,
        })
      }
    })
  }
  return [...candidates.values()]
}

function preliminaryScore(query: string, candidate: RankedCandidate) {
  return textRelevance(query, candidate.item.title) + candidate.apiScore
}

async function geocodeTopMissingCandidates(
  query: string,
  candidates: RankedCandidate[],
) {
  const missingCoordinates = candidates
    .filter(
      ({ item }) => item.latitude === null || item.longitude === null,
    )
    .sort((first, second) =>
      preliminaryScore(query, second) - preliminaryScore(query, first),
    )
    .slice(0, LAZY_GEOCODE_LIMIT)

  await Promise.allSettled(
    missingCoordinates.map(async (candidate) => {
      const coordinates = await resolveRestaurantCoordinates(candidate.item)
      candidate.item = { ...candidate.item, ...coordinates }
    }),
  )
}

function rankCandidate(
  query: string,
  viewport: MapViewport,
  candidate: RankedCandidate,
) {
  const { item } = candidate
  let locationScore = 0
  if (item.latitude !== null && item.longitude !== null) {
    const coordinate = {
      latitude: item.latitude,
      longitude: item.longitude,
    }
    if (isCoordinateInViewport(coordinate, viewport)) locationScore += 48
    const distance = distanceInMeters(viewport.center, coordinate)
    locationScore += Math.max(0, 30 - Math.log10(Math.max(1, distance)) * 8)
  }
  return textRelevance(query, item.title) + locationScore + candidate.apiScore
}

function localizedQueries(query: string, context: ReverseGeocodeResponse) {
  const areas = [context.area3, context.area2, context.area1]
    .filter((area): area is string => Boolean(area))
    .filter((area, index, all) => all.indexOf(area) === index)
    .slice(0, 2)
  return areas.map((area) => `${area} ${query}`)
}

export interface AreaSearchResult {
  response: RestaurantSearchResponse
  contextLabel: string
}

export async function searchRestaurantsInViewport(
  query: string,
  viewport: MapViewport,
  genericItems: RestaurantSearchResult[],
): Promise<AreaSearchResult> {
  const context = await reverseGeocode(viewport.center)
  const queries = localizedQueries(query, context)
  const settledResponses = await Promise.allSettled(
    queries.map(searchRestaurants),
  )
  const localizedResponses = settledResponses.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  )

  if (localizedResponses.length === 0) {
    const firstFailure = settledResponses.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    )
    throw firstFailure?.reason instanceof SearchRequestError
      ? firstFailure.reason
      : new SearchRequestError(SEARCH_UNAVAILABLE_MESSAGE)
  }

  const candidates = mergeCandidates(genericItems, localizedResponses)
  await geocodeTopMissingCandidates(query, candidates)
  const items = candidates
    .sort(
      (first, second) =>
        rankCandidate(query, viewport, second) -
        rankCandidate(query, viewport, first),
    )
    .slice(0, AREA_RESULT_LIMIT)
    .map(({ item }) => item)

  return {
    contextLabel: context.label,
    response: { total: items.length, items },
  }
}
