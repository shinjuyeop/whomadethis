import { type FormEvent, useState } from 'react'
import type {
  RestaurantSearchResponse,
  RestaurantSearchResult,
} from '../types/naverSearch'
import { AppIcon } from './AppIcon'

interface RestaurantSearchProps {
  onSelect: (restaurant: RestaurantSearchResult) => void | Promise<void>
}

const SEARCH_UNAVAILABLE_MESSAGE =
  '검색 서비스를 일시적으로 사용할 수 없습니다.'

class SearchRequestError extends Error {}

function getServerErrorMessage(body: unknown): string | null {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('error' in body) ||
    typeof body.error !== 'object' ||
    body.error === null ||
    !('message' in body.error) ||
    typeof body.error.message !== 'string'
  ) {
    return null
  }

  return body.error.message.trim() || null
}

export function RestaurantSearch({ onSelect }: RestaurantSearchProps) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<RestaurantSearchResponse | null>(null)
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState<'error' | 'success'>('error')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      setMessage('검색어를 입력해 주세요.')
      setMessageKind('error')
      setResult(null)
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const response = await fetch(
        `/api/naver-search?q=${encodeURIComponent(trimmedQuery)}`,
      )
      let body: unknown

      try {
        body = await response.json()
      } catch {
        throw new SearchRequestError(SEARCH_UNAVAILABLE_MESSAGE)
      }

      if (!response.ok) {
        throw new SearchRequestError(
          getServerErrorMessage(body) ?? SEARCH_UNAVAILABLE_MESSAGE,
        )
      }

      setResult(body as RestaurantSearchResponse)
    } catch (error) {
      setResult(null)
      setMessageKind('error')
      setMessage(
        error instanceof SearchRequestError
          ? error.message
          : SEARCH_UNAVAILABLE_MESSAGE,
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
          onChange={(event) => setQuery(event.target.value)}
          placeholder="음식점 이름 검색"
          autoComplete="off"
          maxLength={100}
        />
        <button type="submit" disabled={isLoading} aria-label="음식점 검색">
          {isLoading ? <span aria-hidden="true">…</span> : <AppIcon name="search" />}
        </button>
      </form>

      {message && (
        <p
          className={`feedback feedback--${messageKind}`}
          role={messageKind === 'error' ? 'alert' : 'status'}
        >
          {message}
        </p>
      )}

      {result && (
        <div className="search-results" aria-live="polite">
          {result.items.length === 0 && !isLoading ? (
            <p>검색 결과가 없습니다. 지역명과 음식점 이름을 함께 입력해 보세요.</p>
          ) : (
            <>
              <p>{result.items.length}개의 결과를 찾았습니다.</p>
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
                          <small>{item.category || '음식점'}</small>
                          <span>
                            {item.roadAddress || item.address || '주소 정보 없음'}
                          </span>
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
  )
}
