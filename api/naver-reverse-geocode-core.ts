import type { ReverseGeocodeResponse } from '../src/types/naverReverseGeocode.js'

const NAVER_REVERSE_GEOCODING_URL =
  'https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc'
const REQUEST_TIMEOUT_MS = 8_000

interface ReverseGeocodingCredentials {
  clientId?: string
  clientSecret?: string
}

interface ReverseGeocodingRequest {
  method?: string
  latitude?: string | number | null
  longitude?: string | number | null
  credentials: ReverseGeocodingCredentials
}

interface ReverseGeocodingErrorBody {
  error: {
    code: string
    message: string
  }
}

export interface ReverseGeocodingResult {
  status: number
  body: ReverseGeocodeResponse | ReverseGeocodingErrorBody
  headers?: Record<string, string>
}

function errorResult(
  status: number,
  code: string,
  message: string,
): ReverseGeocodingResult {
  return { status, body: { error: { code, message } } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function coordinate(
  value: string | number | null | undefined,
  minimum: number,
  maximum: number,
) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null
}

function areaName(region: Record<string, unknown>, key: string) {
  const area = region[key]
  if (!isRecord(area) || typeof area.name !== 'string') return null
  return area.name.trim() || null
}

function normalizeResponse(value: unknown): ReverseGeocodeResponse | null {
  if (!isRecord(value) || !Array.isArray(value.results)) return null

  for (const result of value.results) {
    if (!isRecord(result) || !isRecord(result.region)) continue
    const area1 = areaName(result.region, 'area1')
    if (!area1) continue
    const area2 = areaName(result.region, 'area2')
    const area3 = areaName(result.region, 'area3')
    const area4 = areaName(result.region, 'area4')
    return {
      area1,
      area2,
      area3,
      area4,
      label: [area1, area2, area3, area4].filter(Boolean).join(' '),
    }
  }

  return null
}

export async function executeNaverReverseGeocode({
  method,
  latitude: rawLatitude,
  longitude: rawLongitude,
  credentials,
}: ReverseGeocodingRequest): Promise<ReverseGeocodingResult> {
  if (method !== 'GET') {
    return {
      ...errorResult(405, 'METHOD_NOT_ALLOWED', 'GET 요청만 지원합니다.'),
      headers: { Allow: 'GET' },
    }
  }

  const latitude = coordinate(rawLatitude, -90, 90)
  const longitude = coordinate(rawLongitude, -180, 180)
  if (latitude === null || longitude === null) {
    return errorResult(
      400,
      'INVALID_COORDINATES',
      '올바른 위도(latitude)와 경도(longitude)가 필요합니다.',
    )
  }

  const clientId = credentials.clientId?.trim()
  const clientSecret = credentials.clientSecret?.trim()
  if (!clientId || !clientSecret) {
    return errorResult(
      503,
      'REVERSE_GEOCODING_NOT_CONFIGURED',
      '지역 확인 서비스가 아직 설정되지 않았습니다.',
    )
  }

  const url = new URL(NAVER_REVERSE_GEOCODING_URL)
  url.searchParams.set('coords', `${longitude},${latitude}`)
  url.searchParams.set('sourcecrs', 'EPSG:4326')
  url.searchParams.set('orders', 'admcode,legalcode')
  url.searchParams.set('output', 'json')

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
      console.error('NAVER reverse geocoding failed', {
        status: upstreamResponse.status,
      })
      if (upstreamResponse.status === 429) {
        return errorResult(
          429,
          'REVERSE_GEOCODING_RATE_LIMITED',
          '지역 확인 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
        )
      }
      return errorResult(
        502,
        'REVERSE_GEOCODING_UPSTREAM_FAILED',
        '현재 지도 지역을 확인하지 못했습니다.',
      )
    }

    let rawResponse: unknown
    try {
      rawResponse = await upstreamResponse.json()
    } catch {
      return errorResult(
        502,
        'INVALID_UPSTREAM_RESPONSE',
        '지역 확인 서비스가 올바르지 않은 응답을 반환했습니다.',
      )
    }

    const normalizedResponse = normalizeResponse(rawResponse)
    if (!normalizedResponse) {
      return errorResult(
        404,
        'REVERSE_GEOCODING_NOT_FOUND',
        '현재 지도에서 검색할 지역명을 찾지 못했습니다.',
      )
    }

    return { status: 200, body: normalizedResponse }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return errorResult(
        504,
        'REVERSE_GEOCODING_TIMEOUT',
        '지역 확인 시간이 초과되었습니다.',
      )
    }
    console.error('NAVER reverse geocoding request failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
    })
    return errorResult(
      502,
      'REVERSE_GEOCODING_UNAVAILABLE',
      '현재 지도 지역을 확인하지 못했습니다.',
    )
  } finally {
    clearTimeout(timeout)
  }
}
