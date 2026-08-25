import { type FormEvent, useEffect, useRef, useState } from 'react'
import { isLikelyKoreanAddress } from '../lib/addressSearch'
import { hasMeaningfulViewportChange } from '../lib/mapDistance'
import {
  SearchRequestError,
  searchRestaurants,
  searchRestaurantsInViewport,
} from '../lib/naverSearch'
import type { MapViewport } from '../types/map'
import type {
  LocatedRestaurantSearchResult,
  RestaurantSearchResponse,
  RestaurantSearchResult,
} from '../types/naverSearch'
import { AppIcon } from './AppIcon'

interface RestaurantSearchProps {
  viewport: MapViewport | null
  manualLocation: LocatedRestaurantSearchResult | null
  onLocate: (restaurant: RestaurantSearchResult) => void | Promise<void>
  onLocateAddress: (address: string) => Promise<void>
  onReview: (restaurant: RestaurantSearchResult) => void | Promise<void>
  onManualReview: () => void
  onClearLocation: () => void
  onResultsVisibilityChange: (visible: boolean) => void
}

const SEARCH_UNAVAILABLE_MESSAGE =
  '검색 서비스를 일시적으로 사용할 수 없습니다.'

export function RestaurantSearch({
  viewport,
  manualLocation,
  onLocate,
  onLocateAddress,
  onReview,
  onManualReview,
  onClearLocation,
  onResultsVisibilityChange,
}: RestaurantSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const searchRequestRef = useRef(0)
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [result, setResult] = useState<RestaurantSearchResponse | null>(null)
  const [searchAnchor, setSearchAnchor] = useState<MapViewport | null>(null)
  const [searchMode, setSearchMode] = useState<'general' | 'area'>('general')
  const [contextLabel, setContextLabel] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLocatingResult, setIsLocatingResult] = useState(false)
  const [selectedResult, setSelectedResult] =
    useState<RestaurantSearchResult | null>(null)
  const [areResultsCollapsed, setAreResultsCollapsed] = useState(false)

  useEffect(() => {
    onResultsVisibilityChange(result !== null || manualLocation !== null)
  }, [manualLocation, onResultsVisibilityChange, result])

  useEffect(
    () => () => {
      searchRequestRef.current += 1
      onResultsVisibilityChange(false)
    },
    [onResultsVisibilityChange],
  )

  const canSearchCurrentArea = Boolean(
    result &&
      !areResultsCollapsed &&
      viewport &&
      query.trim() === submittedQuery &&
      (searchMode === 'general' ||
        (searchAnchor &&
          hasMeaningfulViewportChange(searchAnchor, viewport))),
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    inputRef.current?.blur()
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      searchRequestRef.current += 1
      setMessage('검색어를 입력해 주세요.')
      setResult(null)
      return
    }

    const requestId = searchRequestRef.current + 1
    searchRequestRef.current = requestId
    setIsLoading(true)
    setMessage('')
    setContextLabel('')
    setSearchMode('general')
    setSelectedResult(null)
    setAreResultsCollapsed(false)
    onClearLocation()

    if (isLikelyKoreanAddress(trimmedQuery)) {
      setResult(null)
      setSearchAnchor(null)
      try {
        await onLocateAddress(trimmedQuery)
        if (requestId !== searchRequestRef.current) return
        setSubmittedQuery(trimmedQuery)
      } catch (error) {
        if (requestId !== searchRequestRef.current) return
        setMessage(
          error instanceof Error && error.message
            ? error.message
            : '입력한 주소의 위치를 확인하지 못했습니다.',
        )
      } finally {
        if (requestId === searchRequestRef.current) setIsLoading(false)
      }
      return
    }

    try {
      const nextResult = await searchRestaurants(trimmedQuery)
      if (requestId !== searchRequestRef.current) return
      setResult(nextResult)
      setSubmittedQuery(trimmedQuery)
      setSearchAnchor(viewport)
    } catch (error) {
      if (requestId !== searchRequestRef.current) return
      setResult(null)
      setMessage(
        error instanceof SearchRequestError
          ? error.message
          : SEARCH_UNAVAILABLE_MESSAGE,
      )
    } finally {
      if (requestId === searchRequestRef.current) setIsLoading(false)
    }
  }

  async function handleAreaSearch() {
    if (!viewport || !result || !submittedQuery || isLoading) return

    const requestId = searchRequestRef.current + 1
    searchRequestRef.current = requestId
    setIsLoading(true)
    setMessage('')
    try {
      const areaResult = await searchRestaurantsInViewport(
        submittedQuery,
        viewport,
        result.items,
      )
      if (requestId !== searchRequestRef.current) return
      setResult(areaResult.response)
      setContextLabel(areaResult.contextLabel)
      setSearchMode('area')
      setSearchAnchor(viewport)
      setSelectedResult(null)
      setAreResultsCollapsed(false)
    } catch (error) {
      if (requestId !== searchRequestRef.current) return
      setMessage(
        error instanceof SearchRequestError
          ? error.message
          : '현재 지도 지역에서 검색하지 못했습니다.',
      )
    } finally {
      if (requestId === searchRequestRef.current) setIsLoading(false)
    }
  }

  async function handleLocate(item: RestaurantSearchResult) {
    const requestId = searchRequestRef.current + 1
    searchRequestRef.current = requestId
    setMessage('')
    setIsLocatingResult(true)
    try {
      await onLocate(item)
      if (requestId !== searchRequestRef.current) return
      setSelectedResult(item)
      setAreResultsCollapsed(true)
    } catch (error) {
      if (requestId !== searchRequestRef.current) return
      setMessage(
        error instanceof Error && error.message
          ? error.message
          : '이 장소의 위치를 확인하지 못했습니다.',
      )
    } finally {
      if (requestId === searchRequestRef.current) setIsLocatingResult(false)
    }
  }

  function handleReview(item: RestaurantSearchResult) {
    setMessage('')
    void onReview(item)
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
            ref={inputRef}
            id="restaurant-query"
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value
              setQuery(nextQuery)
              if (nextQuery.trim() !== submittedQuery) {
                searchRequestRef.current += 1
                setIsLoading(false)
                setIsLocatingResult(false)
                setResult(null)
                setSelectedResult(null)
                setAreResultsCollapsed(false)
                setSearchMode('general')
                setContextLabel('')
                onClearLocation()
              }
            }}
            placeholder="음식점 이름 또는 주소 검색"
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

        {result && !areResultsCollapsed && (
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
                          className="search-result-location"
                          type="button"
                          disabled={isLocatingResult}
                          aria-label={`${item.title} 위치 보기`}
                          onClick={() => void handleLocate(item)}
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
                        </button>
                        <button
                          className="search-result-review"
                          type="button"
                          disabled={isLocatingResult}
                          aria-label={`${item.title} 후기 남기기`}
                          onClick={() => handleReview(item)}
                        >
                          후기 남기기
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        {result && areResultsCollapsed && selectedResult && (
          <div className="selected-search-result" aria-live="polite">
            <button
              className="selected-search-result-location"
              type="button"
              disabled={isLocatingResult}
              aria-label={`${selectedResult.title} 위치 다시 보기`}
              onClick={() => void handleLocate(selectedResult)}
            >
              <strong>{selectedResult.title}</strong>
              <small>
                {isLocatingResult ? '위치 확인 중…' : '지도에 표시 중'}
              </small>
            </button>
            <button
              className="selected-search-result-action"
              type="button"
              aria-label={`${selectedResult.title} 후기 남기기`}
              onClick={() => handleReview(selectedResult)}
            >
              후기
            </button>
            <button
              className="selected-search-result-action"
              type="button"
              onClick={() => setAreResultsCollapsed(false)}
            >
              다른 결과
            </button>
          </div>
        )}

        {manualLocation?.kind === 'manual' && (
          <div className="manual-location-result" aria-live="polite">
            <div>
              <strong>주소 위치를 표시했습니다.</strong>
              <span>
                {manualLocation.roadAddress || manualLocation.address}
              </span>
              <small>핀을 움직여 정확한 위치로 조정할 수 있어요.</small>
            </div>
            <button type="button" onClick={onManualReview}>
              이 위치에 장소 등록
            </button>
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
