import type { GeocodeResponse } from '../src/types/naverGeocode.js'

const NAVER_GEOCODING_URL =
  'https://maps.apigw.ntruss.com/map-geocode/v2/geocode'
const REQUEST_TIMEOUT_MS = 8_000
export const MAX_GEOCODING_ADDRESS_LENGTH = 300

interface GeocodingCredentials {
  clientId?: string
  clientSecret?: string
}

interface GeocodingRequest {
  method?: string
  address?: string | null
  credentials: GeocodingCredentials
}

interface GeocodingErrorBody {
  error: {
    code: string
    message: string
  }
}

export interface GeocodingResult {
  status: number
  body: GeocodeResponse | GeocodingErrorBody
  headers?: Record<string, string>
}

function errorResult(
  status: number,
  code: string,
  message: string,
): GeocodingResult {
  return { status, body: { error: { code, message } } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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

function normalizeResponse(value: unknown): GeocodeResponse | null {
  if (
    !isRecord(value) ||
    value.status !== 'OK' ||
    !Array.isArray(value.addresses)
  ) {
    return null
  }

  for (const address of value.addresses) {
    if (!isRecord(address)) continue

    const longitude = coordinate(address.x, -180, 180)
    const latitude = coordinate(address.y, -90, 90)
    if (latitude !== null && longitude !== null) {
      return { latitude, longitude }
    }
  }

  return null
}

function hasNoResults(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.status === 'OK' &&
    Array.isArray(value.addresses) &&
    value.addresses.length === 0
  )
}

export async function executeNaverGeocode({
  method,
  address: rawAddress,
  credentials,
}: GeocodingRequest): Promise<GeocodingResult> {
  if (method !== 'GET') {
    return {
      ...errorResult(405, 'METHOD_NOT_ALLOWED', 'GET 요청만 지원합니다.'),
      headers: { Allow: 'GET' },
    }
  }

  const address = rawAddress?.trim() ?? ''
  if (!address) {
    return errorResult(400, 'INVALID_ADDRESS', '주소(address)를 입력해 주세요.')
  }

  if (Array.from(address).length > MAX_GEOCODING_ADDRESS_LENGTH) {
    return errorResult(
      400,
      'ADDRESS_TOO_LONG',
      `주소는 ${MAX_GEOCODING_ADDRESS_LENGTH}자 이하로 입력해 주세요.`,
    )
  }

  const clientId = credentials.clientId?.trim()
  const clientSecret = credentials.clientSecret?.trim()
  if (!clientId || !clientSecret) {
    return errorResult(
      503,
      'GEOCODING_NOT_CONFIGURED',
      '위치 확인 서비스가 아직 설정되지 않았습니다.',
    )
  }

  const url = new URL(NAVER_GEOCODING_URL)
  url.searchParams.set('query', address)
  url.searchParams.set('count', '1')

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
      console.error('NAVER geocoding failed', {
        status: upstreamResponse.status,
      })

      if (upstreamResponse.status === 429) {
        return errorResult(
          429,
          'GEOCODING_RATE_LIMITED',
          '위치 확인 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
        )
      }

      return errorResult(
        502,
        upstreamResponse.status >= 500
          ? 'GEOCODING_UPSTREAM_UNAVAILABLE'
          : 'GEOCODING_UPSTREAM_REJECTED',
        '위치 확인 서비스 응답을 처리하지 못했습니다.',
      )
    }

    let rawResponse: unknown
    try {
      rawResponse = await upstreamResponse.json()
    } catch {
      return errorResult(
        502,
        'INVALID_UPSTREAM_RESPONSE',
        '위치 확인 서비스가 올바르지 않은 응답을 반환했습니다.',
      )
    }

    if (hasNoResults(rawResponse)) {
      return errorResult(
        404,
        'GEOCODING_NOT_FOUND',
        '이 장소의 위치를 확인하지 못했습니다.',
      )
    }

    const coordinates = normalizeResponse(rawResponse)
    if (!coordinates) {
      return errorResult(
        502,
        'INVALID_UPSTREAM_RESPONSE',
        '위치 확인 서비스가 올바르지 않은 응답을 반환했습니다.',
      )
    }

    return { status: 200, body: coordinates }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return errorResult(
        504,
        'GEOCODING_TIMEOUT',
        '위치 확인 서비스 응답 시간이 초과되었습니다.',
      )
    }

    console.error('NAVER geocoding request failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
    })
    return errorResult(
      502,
      'GEOCODING_UNAVAILABLE',
      '위치 확인 서비스를 일시적으로 사용할 수 없습니다.',
    )
  } finally {
    clearTimeout(timeout)
  }
}
