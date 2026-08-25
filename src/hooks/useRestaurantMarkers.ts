import { useEffect, useRef } from 'react'
import type { Restaurant } from '../types/database'

interface MarkerEntry {
  marker: NaverMarkerInstance
  listener: NaverMapsEventListener
  restaurant: Restaurant
}

export function useRestaurantMarkers(
  map: NaverMapInstance | null,
  restaurants: Restaurant[],
  onSelect: (restaurant: Restaurant) => void,
) {
  const entriesRef = useRef(new Map<string, MarkerEntry>())
  const onSelectRef = useRef(onSelect)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    if (!map) return
    const entries = entriesRef.current
    return () => {
      for (const { marker, listener } of entries.values()) {
        try {
          window.naver?.maps?.Event.removeListener(listener)
          marker.setMap(null)
        } catch {
          // The map may already be tearing down; stale overlays are discarded
          // with its container in that case.
        }
      }
      entries.clear()
    }
  }, [map])

  useEffect(() => {
    const maps = window.naver?.maps
    if (!map || !maps) return

    const entries = entriesRef.current
    const restaurantIds = new Set(restaurants.map(({ id }) => id))
    for (const [restaurantId, entry] of entries) {
      if (restaurantIds.has(restaurantId)) continue
      maps.Event.removeListener(entry.listener)
      entry.marker.setMap(null)
      entries.delete(restaurantId)
    }

    for (const restaurant of restaurants) {
      const existing = entries.get(restaurant.id)
      if (existing) {
        const locationChanged =
          existing.restaurant.latitude !== restaurant.latitude ||
          existing.restaurant.longitude !== restaurant.longitude
        existing.restaurant = restaurant
        if (locationChanged) {
          existing.marker.setPosition(
            new maps.LatLng(restaurant.latitude, restaurant.longitude),
          )
        }
        continue
      }

      const marker = new maps.Marker({
        map,
        position: new maps.LatLng(
          restaurant.latitude,
          restaurant.longitude,
        ),
        title: restaurant.name,
      })
      const entry: MarkerEntry = {
        marker,
        restaurant,
        listener: maps.Event.addListener(marker, 'click', () => {
          const current = entriesRef.current.get(restaurant.id)
          if (current) onSelectRef.current(current.restaurant)
        }),
      }
      entries.set(restaurant.id, entry)
    }
  }, [map, restaurants])
}
