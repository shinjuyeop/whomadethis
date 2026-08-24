const NAVER_MAPS_SCRIPT_ID = 'naver-maps-script'
const NAVER_MAPS_TIMEOUT_MS = 10_000

let loadPromise: Promise<void> | null = null

export function loadNaverMaps(clientId: string): Promise<void> {
  if (window.naver?.maps) {
    return Promise.resolve()
  }

  if (loadPromise) {
    return loadPromise
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    let script = document.getElementById(
      NAVER_MAPS_SCRIPT_ID,
    ) as HTMLScriptElement | null

    if (script) {
      script.remove()
      script = null
    }

    const timeout = window.setTimeout(() => {
      script?.remove()
      loadPromise = null
      reject(new Error('NAVER Maps API 응답 시간이 초과되었습니다.'))
    }, NAVER_MAPS_TIMEOUT_MS)

    const handleLoad = () => {
      window.clearTimeout(timeout)
      if (window.naver?.maps) {
        resolve()
        return
      }

      loadPromise = null
      reject(new Error('NAVER Maps API가 준비되지 않았습니다.'))
    }

    const handleError = () => {
      window.clearTimeout(timeout)
      loadPromise = null
      reject(new Error('NAVER Maps API 스크립트를 불러오지 못했습니다.'))
    }

    script = document.createElement('script')
    script.id = NAVER_MAPS_SCRIPT_ID
    script.async = true
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`
    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })
    document.head.appendChild(script)
  })

  return loadPromise
}
