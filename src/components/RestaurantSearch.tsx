import { type FormEvent, useEffect, useState } from 'react'
import { hasMeaningfulViewportChange } from '../lib/mapDistance'
import {
  SearchRequestError,
  searchRestaurants,
  searchRestaurantsInViewport,
} from '../lib/naverSearch'
import type { MapViewport } from '../types/map'
import type {
  RestaurantSearchResponse,
  RestaurantSearchResult,
} from '../types/naverSearch'
import { AppIcon } from './AppIcon'

interface RestaurantSearchProps {
  viewport: MapViewport | null
  onSelect: (restaurant: RestaurantSearchResult) => void | Promise<void>
  onResultsVisibilityChange: (visible: boolean) => void
}

const SEARCH_UNAVAILABLE_MESSAGE =
  '검색 서비스를 일시적으로 사용할 수 없습니다.'

export function RestaurantSearch({
  viewport,
  onSelect,
  onResultsVisibilityChange,
}: RestaurantSearchProps) {
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [result, setResult] = useState<RestaurantSearchResponse | null>(null)
  const [searchAnchor, setSearchAnchor] = useState<MapViewport | null>(null)
  const [searchMode, setSearchMode] = useState<'general' | 'area'>('general')
  const [contextLabel, setContextLabel] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    onResultsVisibilityChange(result !== null)
  }, [onResultsVisibilityChange, result])

  useEffect(
    () => () => onResultsVisibilityChange(false),
    [onResultsVisibilityChange],
  )

  const canSearchCurrentArea = Boolean(
    result &&
      viewport &&
      searchAnchor &&
      query.trim() === submittedQuery &&
      hasMeaningfulViewportChange(searchAnchor, viewport),
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      setMessage('검색어를 입력해 주세요.')
      setResult(null)
      return
    }

    setIsLoading(true)
    setMessage('')
    try {
      const nextResult = await searchRestaurants(trimmedQuery)
      setResult(nextResult)
      setSubmittedQuery(trimmedQuery)
      setSearchAnchor(viewport)
      setSearchMode('general')
      setContextLabel('')
    } catch (error) {
      setResult(null)
      setMessage(
        error instanceof SearchRequestError
          ? error.message
          : SEARCH_UNAVAILABLE_MESSAGE,
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAreaSearch() {
    if (!viewport || !result || !submittedQuery || isLoading) return

    setIsLoading(true)
    setMessage('')
    try {
      const areaResult = await searchRestaurantsInViewport(
        submittedQuery,
        viewport,
        result.items,
      )
      setResult(areaResult.response)
      setContextLabel(areaResult.contextLabel)
      setSearchMode('area')
      setSearchAnchor(viewport)
    } catch (error) {
      setMessage(
        error instanceof SearchRequestError
          ? error.message
          : '현재 지도 지역에서 검색하지 못했습니다.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  function handleSelect(item: RestaurantSearchResult) {
    setMessage('')
    void onSelect(item)
  }

  return (
    <div className="search-stack">
      <section className="search-panel" aria-labelledby="search-title">
        <h2 id="search-title" className="sr-only">
          음식점 검색
        </h2>
        <form className="search-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="restaurant-query">
            음식점 또는 지역 검색
          </label>
          <input
            id="restaurant-query"
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value
              setQuery(nextQuery)
              if (nextQuery.trim() !== submittedQuery) {
                setResult(null)
                setSearchMode('general')
                setContextLabel('')
              }
            }}
            placeholder="음식점 이름 검색"
            autoComplete="off"
            maxLength={100}
          />
          <button type="submit" disabled={isLoading} aria-label="음식점 검색">
            {isLoading ? (
              <span aria-hidden="true">…</span>
            ) : (
              <AppIcon name="search" />
            )}
          </button>
        </form>

        {message && (
          <p className="feedback feedback--error" role="alert">
            {message}
          </p>
        )}

        {result && (
          <div className="search-results" aria-live="polite">
            {result.items.length === 0 && !isLoading ? (
              <p>
                검색 결과가 없습니다. 지역명과 음식점 이름을 함께 입력해
                보세요.
              </p>
            ) : (
              <>
                <p>
                  {searchMode === 'area' && contextLabel ? (
                    <>
                      <strong>현재 지도 지역 기준</strong>
                      <span> · {contextLabel}</span>
                    </>
                  ) : (
                    `${result.items.length}개의 결과를 찾았습니다.`
                  )}
                </p>
                <ul>
                  {result.items.map((item, index) => {
                    const key = `${item.longitude}-${item.latitude}-${item.title}-${index}`
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => handleSelect(item)}
                        >
                          <span className="search-result-copy">
                            <strong>{item.title}</strong>
                            <span>
                              {item.roadAddress ||
                                item.address ||
                                '주소 정보 없음'}
                            </span>
                            <small>{item.category || '음식점'}</small>
                          </span>
                          <span className="search-result-action">
                            후기 남기기
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      {canSearchCurrentArea && (
        <button
          className="area-search-button"
          type="button"
          aria-label="현재 지도 영역에서 다시 검색"
          disabled={isLoading}
          onClick={() => void handleAreaSearch()}
        >
          {isLoading ? '지역 확인 중…' : `이 지역에서 “${submittedQuery}” 검색`}
        </button>
      )}
    </div>
  )
}
