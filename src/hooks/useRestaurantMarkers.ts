import { useEffect } from 'react'
import type { Restaurant } from '../types/database'

export function useRestaurantMarkers(
  map: NaverMapInstance | null,
  restaurants: Restaurant[],
  onSelect: (restaurant: Restaurant) => void,
) {
  useEffect(() => {
    if (!map || !window.naver?.maps) {
      return
    }

    const { maps } = window.naver
    const markerEntries = restaurants.map((restaurant) => {
      const marker = new maps.Marker({
        map,
        position: new maps.LatLng(
          restaurant.latitude,
          restaurant.longitude,
        ),
        title: restaurant.name,
      })
      const listener = maps.Event.addListener(marker, 'click', () => {
        onSelect(restaurant)
      })

      return { marker, listener }
    })

    return () => {
      for (const { marker, listener } of markerEntries) {
        maps.Event.removeListener(listener)
        marker.setMap(null)
      }
    }
  }, [map, onSelect, restaurants])
}
