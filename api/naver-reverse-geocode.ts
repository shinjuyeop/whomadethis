import { executeNaverReverseGeocode } from './naver-reverse-geocode-core.js'

interface VercelRequest {
  method?: string
  query: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  setHeader(name: string, value: string): VercelResponse
  status(statusCode: number): VercelResponse
  json(body: unknown): VercelResponse
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  response.setHeader('Cache-Control', 'no-store')
  const result = await executeNaverReverseGeocode({
    method: request.method,
    latitude: firstQueryValue(request.query.latitude),
    longitude: firstQueryValue(request.query.longitude),
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
