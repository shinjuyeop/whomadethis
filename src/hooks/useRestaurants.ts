import { useCallback, useEffect, useState } from 'react'
import {
  findOrCreateRestaurant,
  loadRestaurants,
} from '../lib/restaurants'
import type { Restaurant } from '../types/database'
import type { RestaurantSearchResult } from '../types/naverSearch'

type LoadStatus = 'loading' | 'success' | 'error'

export function useRestaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  const refresh = useCallback(async () => {
    setStatus('loading')
    setErrorMessage('')

    try {
      setRestaurants(await loadRestaurants())
      setStatus('success')
    } catch {
      setErrorMessage('저장된 장소를 불러오지 못했습니다.')
      setStatus('error')
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

  const selectSearchResult = useCallback(
    async (result: RestaurantSearchResult) => {
      const restaurant = await findOrCreateRestaurant(result)
      setRestaurants((current) => {
        const exists = current.some((item) => item.id === restaurant.id)
        return exists
          ? current.map((item) =>
              item.id === restaurant.id ? restaurant : item,
            )
          : [...current, restaurant]
      })
      return restaurant
    },
    [],
  )

  return {
    restaurants,
    status,
    errorMessage,
    refresh,
    selectSearchResult,
  }
}
