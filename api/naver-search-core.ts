import type {
  RestaurantSearchResponse,
  RestaurantSearchResult,
} from '../src/types/naverSearch.ts'

const NAVER_LOCAL_SEARCH_URL =
  'https://naverapihub.apigw.ntruss.com/search/v1/local'
const REQUEST_TIMEOUT_MS = 8_000
export const MAX_SEARCH_QUERY_LENGTH = 100

interface SearchCredentials {
  clientId?: string
  clientSecret?: string
}

interface SearchRequest {
  method?: string
  query?: string | null
  credentials: SearchCredentials
}

interface SearchErrorBody {
  error: {
    code: string
    message: string
  }
}

export interface SearchResult {
  status: number
  body: RestaurantSearchResponse | SearchErrorBody
  headers?: Record<string, string>
}

function errorResult(status: number, code: string, message: string): SearchResult {
  return { status, body: { error: { code, message } } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function nullableText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function stripMarkup(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim()
}

function safeLink(value: unknown): string | null {
  const link = nullableText(value)
  if (!link) {
    return null
  }

  try {
    const url = new URL(link)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function coordinate(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null
}

function normalizeItem(value: unknown): RestaurantSearchResult | null {
  if (!isRecord(value) || typeof value.title !== 'string') {
    return null
  }

  const title = stripMarkup(value.title)
  if (!title) {
    return null
  }

  return {
    title,
    category: nullableText(value.category),
    address: nullableText(value.address),
    roadAddress: nullableText(value.roadAddress),
    // NAVER documents mapx as WGS84 longitude and mapy as WGS84 latitude.
    latitude: coordinate(value.mapy, -90, 90),
    longitude: coordinate(value.mapx, -180, 180),
    link: safeLink(value.link),
  }
}

function normalizeResponse(value: unknown): RestaurantSearchResponse | null {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return null
  }

  const total =
    typeof value.total === 'number' && Number.isInteger(value.total)
      ? Math.max(0, value.total)
      : value.items.length

  return {
    total,
    items: value.items
      .map(normalizeItem)
      .filter((item): item is RestaurantSearchResult => item !== null),
  }
}

export async function executeNaverSearch({
  method,
  query: rawQuery,
  credentials,
}: SearchRequest): Promise<SearchResult> {
  if (method !== 'GET') {
    return {
      ...errorResult(405, 'METHOD_NOT_ALLOWED', 'GET 요청만 지원합니다.'),
      headers: { Allow: 'GET' },
    }
  }

  const query = rawQuery?.trim() ?? ''
  if (!query) {
    return errorResult(400, 'INVALID_QUERY', '검색어(q)를 입력해 주세요.')
  }

  if (Array.from(query).length > MAX_SEARCH_QUERY_LENGTH) {
    return errorResult(
      400,
      'QUERY_TOO_LONG',
      `검색어는 ${MAX_SEARCH_QUERY_LENGTH}자 이하로 입력해 주세요.`,
    )
  }

  const clientId = credentials.clientId?.trim()
  const clientSecret = credentials.clientSecret?.trim()
  if (!clientId || !clientSecret) {
    return errorResult(
      503,
      'SEARCH_NOT_CONFIGURED',
      '지역 검색 서비스가 아직 설정되지 않았습니다.',
    )
  }

  const url = new URL(NAVER_LOCAL_SEARCH_URL)
  url.searchParams.set('query', query)
  url.searchParams.set('display', '5')
  url.searchParams.set('start', '1')
  url.searchParams.set('sort', 'random')
  url.searchParams.set('format', 'json')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const upstreamResponse = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
      signal: controller.signal,
    })

    if (!upstreamResponse.ok) {
      console.error('NAVER local search failed', {
        status: upstreamResponse.status,
      })

      if (upstreamResponse.status === 429) {
        return errorResult(
          429,
          'SEARCH_RATE_LIMITED',
          '검색 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
        )
      }

      return errorResult(
        502,
        upstreamResponse.status >= 500
          ? 'SEARCH_UPSTREAM_UNAVAILABLE'
          : 'SEARCH_UPSTREAM_REJECTED',
        '지역 검색 서비스 응답을 처리하지 못했습니다.',
      )
    }

    let rawResponse: unknown
    try {
      rawResponse = await upstreamResponse.json()
    } catch {
      return errorResult(
        502,
        'INVALID_UPSTREAM_RESPONSE',
        '지역 검색 서비스가 올바르지 않은 응답을 반환했습니다.',
      )
    }

    const normalizedResponse = normalizeResponse(rawResponse)
    if (!normalizedResponse) {
      return errorResult(
        502,
        'INVALID_UPSTREAM_RESPONSE',
        '지역 검색 서비스가 올바르지 않은 응답을 반환했습니다.',
      )
    }

    return { status: 200, body: normalizedResponse }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return errorResult(
        504,
        'SEARCH_TIMEOUT',
        '지역 검색 서비스 응답 시간이 초과되었습니다.',
      )
    }

    console.error('NAVER local search request failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
    })
    return errorResult(
      502,
      'SEARCH_UNAVAILABLE',
      '지역 검색 서비스를 일시적으로 사용할 수 없습니다.',
    )
  } finally {
    clearTimeout(timeout)
  }
}
