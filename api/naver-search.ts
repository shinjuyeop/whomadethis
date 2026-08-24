const NAVER_LOCAL_SEARCH_URL =
  'https://naverapihub.apigw.ntruss.com/search/v1/local'
const REQUEST_TIMEOUT_MS = 8_000

interface VercelRequest {
  method?: string
  query: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  setHeader(name: string, value: string): VercelResponse
  status(statusCode: number): VercelResponse
  json(body: unknown): VercelResponse
}

interface SafeError {
  error: {
    code: string
    message: string
  }
}

function sendError(
  response: VercelResponse,
  status: number,
  code: string,
  message: string,
) {
  return response.status(status).json({ error: { code, message } } satisfies SafeError)
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader('Cache-Control', 'no-store')

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return sendError(
      response,
      405,
      'METHOD_NOT_ALLOWED',
      'GET 요청만 지원합니다.',
    )
  }

  const rawQuery = Array.isArray(request.query.q)
    ? request.query.q[0]
    : request.query.q
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : ''

  if (!query) {
    return sendError(
      response,
      400,
      'INVALID_QUERY',
      '검색어(q)를 입력해 주세요.',
    )
  }

  const clientId = process.env.NAVER_API_HUB_CLIENT_ID?.trim()
  const clientSecret = process.env.NAVER_API_HUB_CLIENT_SECRET?.trim()

  if (!clientId || !clientSecret) {
    return sendError(
      response,
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
    const naverResponse = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
      signal: controller.signal,
    })

    if (!naverResponse.ok) {
      console.error('NAVER local search failed', {
        status: naverResponse.status,
      })

      if (naverResponse.status === 429) {
        return sendError(
          response,
          429,
          'SEARCH_RATE_LIMITED',
          '검색 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
        )
      }

      return sendError(
        response,
        502,
        'SEARCH_UPSTREAM_ERROR',
        '지역 검색 서비스 응답을 처리하지 못했습니다.',
      )
    }

    const data: unknown = await naverResponse.json()
    return response.status(200).json(data)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return sendError(
        response,
        504,
        'SEARCH_TIMEOUT',
        '지역 검색 서비스 응답 시간이 초과되었습니다.',
      )
    }

    console.error('NAVER local search request failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
    })
    return sendError(
      response,
      502,
      'SEARCH_UNAVAILABLE',
      '지역 검색 서비스를 일시적으로 사용할 수 없습니다.',
    )
  } finally {
    clearTimeout(timeout)
  }
}
