import { executeNaverGeocode } from './naver-geocode-core.js'

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

  const rawAddress = Array.isArray(request.query.address)
    ? request.query.address[0]
    : request.query.address
  const result = await executeNaverGeocode({
    method: request.method,
    address: rawAddress,
    credentials: {
      clientId: process.env.NAVER_MAP_CLIENT_ID,
      clientSecret: process.env.NAVER_MAP_CLIENT_SECRET,
    },
  })

  for (const [name, value] of Object.entries(result.headers ?? {})) {
    response.setHeader(name, value)
  }

  return response.status(result.status).json(result.body)
}
