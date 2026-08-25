import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { executeNaverGeocode } from './api/naver-geocode-core.js'
import { executeNaverReverseGeocode } from './api/naver-reverse-geocode-core.js'
import { executeNaverSearch } from './api/naver-search-core.js'

interface ServerCredentials {
  search: {
    clientId?: string
    clientSecret?: string
  }
  geocoding: {
    clientId?: string
    clientSecret?: string
  }
}

function localNaverApi(credentials: ServerCredentials): Plugin {
  return {
    name: 'local-naver-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/naver-search', async (request, response) => {
        const url = new URL(request.url ?? '/', 'http://localhost')
        const result = await executeNaverSearch({
          method: request.method,
          query: url.searchParams.get('q'),
          credentials: credentials.search,
        })

        response.statusCode = result.status
        response.setHeader('Cache-Control', 'no-store')
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        for (const [name, value] of Object.entries(result.headers ?? {})) {
          response.setHeader(name, value)
        }
        response.end(JSON.stringify(result.body))
      })

      server.middlewares.use(
        '/api/naver-geocode',
        async (request, response) => {
          const url = new URL(request.url ?? '/', 'http://localhost')
          const result = await executeNaverGeocode({
            method: request.method,
            address: url.searchParams.get('address'),
            credentials: credentials.geocoding,
          })

          response.statusCode = result.status
          response.setHeader('Cache-Control', 'no-store')
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          for (const [name, value] of Object.entries(result.headers ?? {})) {
            response.setHeader(name, value)
          }
          response.end(JSON.stringify(result.body))
        },
      )

      server.middlewares.use(
        '/api/naver-reverse-geocode',
        async (request, response) => {
          const url = new URL(request.url ?? '/', 'http://localhost')
          const result = await executeNaverReverseGeocode({
            method: request.method,
            latitude: url.searchParams.get('latitude'),
            longitude: url.searchParams.get('longitude'),
            credentials: credentials.geocoding,
          })

          response.statusCode = result.status
          response.setHeader('Cache-Control', 'no-store')
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          for (const [name, value] of Object.entries(result.headers ?? {})) {
            response.setHeader(name, value)
          }
          response.end(JSON.stringify(result.body))
        },
      )
    },
  }
}

export default defineConfig(({ mode }) => {
  // loadEnv runs only in the Vite Node process. Non-VITE_ values are never
  // exposed through import.meta.env or included in the browser bundle.
  const serverEnv = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      localNaverApi({
        search: {
          clientId: serverEnv.NAVER_API_HUB_CLIENT_ID,
          clientSecret: serverEnv.NAVER_API_HUB_CLIENT_SECRET,
        },
        geocoding: {
          clientId: serverEnv.NAVER_MAP_CLIENT_ID,
          clientSecret: serverEnv.NAVER_MAP_CLIENT_SECRET,
        },
      }),
    ],
  }
})
