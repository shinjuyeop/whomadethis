const NAVER_MAPS_SCRIPT_ID = 'naver-maps-script'

let loadPromise: Promise<void> | null = null

export function loadNaverMaps(clientId: string): Promise<void> {
  if (window.naver?.maps) {
    return Promise.resolve()
  }

  if (loadPromise) {
    return loadPromise
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(
      NAVER_MAPS_SCRIPT_ID,
    ) as HTMLScriptElement | null

    const handleLoad = () => {
      if (window.naver?.maps) {
        resolve()
        return
      }

      loadPromise = null
      reject(new Error('NAVER Maps API가 준비되지 않았습니다.'))
    }

    const handleError = () => {
      loadPromise = null
      reject(new Error('NAVER Maps API 스크립트를 불러오지 못했습니다.'))
    }

    if (existingScript) {
      existingScript.addEventListener('load', handleLoad, { once: true })
      existingScript.addEventListener('error', handleError, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = NAVER_MAPS_SCRIPT_ID
    script.async = true
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`
    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })
    document.head.appendChild(script)
  })

  return loadPromise
}
