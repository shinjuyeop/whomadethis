import { useCallback, useEffect, useState } from 'react'
import { loadRestaurants } from '../lib/restaurants'
import type { Restaurant } from '../types/database'

type LoadStatus = 'loading' | 'success' | 'error'

export function useRestaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  const refresh = useCallback(async () => {
    setStatus('loading')
    setErrorMessage('')

    try {
      const loadedRestaurants = await loadRestaurants()
      setRestaurants(loadedRestaurants)
      setStatus('success')
      return loadedRestaurants
    } catch {
      setErrorMessage('저장된 장소를 불러오지 못했습니다.')
      setStatus('error')
      throw new Error('저장된 장소를 불러오지 못했습니다.')
    }
  }, [])

  useEffect(() => {
    let active = true

    void loadRestaurants()
      .then((loadedRestaurants) => {
        if (!active) return
        setRestaurants(loadedRestaurants)
        setStatus('success')
      })
      .catch(() => {
        if (!active) return
        setErrorMessage('저장된 장소를 불러오지 못했습니다.')
        setStatus('error')
      })

    return () => {
      active = false
    }
  }, [])

  return {
    restaurants,
    status,
    errorMessage,
    refresh,
  }
}
