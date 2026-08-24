import { executeNaverSearch } from './naver-search-core.js'

interface VercelRequest {
  method?: string
  query: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  setHeader(name: string, value: string): VercelResponse
  status(statusCode: number): VercelResponse
  json(body: unknown): VercelResponse
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader('Cache-Control', 'no-store')

  const rawQuery = Array.isArray(request.query.q)
    ? request.query.q[0]
    : request.query.q
  const result = await executeNaverSearch({
    method: request.method,
    query: rawQuery,
    credentials: {
      clientId: process.env.NAVER_API_HUB_CLIENT_ID,
      clientSecret: process.env.NAVER_API_HUB_CLIENT_SECRET,
    },
  })

  for (const [name, value] of Object.entries(result.headers ?? {})) {
    response.setHeader(name, value)
  }

  return response.status(result.status).json(result.body)
}
