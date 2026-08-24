import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { executeNaverSearch } from './api/naver-search-core.ts'

function localSearchApi(credentials: {
  clientId?: string
  clientSecret?: string
}): Plugin {
  return {
    name: 'local-naver-search-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/naver-search', async (request, response) => {
        const url = new URL(request.url ?? '/', 'http://localhost')
        const result = await executeNaverSearch({
          method: request.method,
          query: url.searchParams.get('q'),
          credentials,
        })

        response.statusCode = result.status
        response.setHeader('Cache-Control', 'no-store')
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        for (const [name, value] of Object.entries(result.headers ?? {})) {
          response.setHeader(name, value)
        }
        response.end(JSON.stringify(result.body))
      })
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
      localSearchApi({
        clientId: serverEnv.NAVER_API_HUB_CLIENT_ID,
        clientSecret: serverEnv.NAVER_API_HUB_CLIENT_SECRET,
      }),
    ],
  }
})
