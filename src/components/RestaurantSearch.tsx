import { type FormEvent, useState } from 'react'
import type {
  RestaurantSearchResponse,
  RestaurantSearchResult,
} from '../types/naverSearch'

interface RestaurantSearchProps {
  onSelect: (restaurant: RestaurantSearchResult) => void
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
  const [isLoading, setIsLoading] = useState(false)

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
      setMessage(
        error instanceof SearchRequestError
          ? error.message
          : SEARCH_UNAVAILABLE_MESSAGE,
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="search-panel" aria-labelledby="search-title">
      <div>
        <p className="eyebrow">PLACE SEARCH</p>
        <h2 id="search-title">어디에서 맛있는 걸 먹었나요?</h2>
      </div>
      <form className="search-form" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="restaurant-query">
          음식점 또는 지역 검색
        </label>
        <input
          id="restaurant-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="예: 성수동 파스타"
          autoComplete="off"
          maxLength={100}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? '검색 중…' : '검색'}
        </button>
      </form>

      {message && (
        <p className="feedback" role="alert">
          {message}
        </p>
      )}

      {result && (
        <div className="search-results" aria-live="polite">
          {result.items.length === 0 ? (
            <p>검색 결과가 없습니다. 지역명과 음식점 이름을 함께 입력해 보세요.</p>
          ) : (
            <>
              <p>{result.items.length}개의 결과를 찾았습니다.</p>
              <ul>
                {result.items.map((item, index) => (
                  <li
                    key={`${item.longitude}-${item.latitude}-${item.title}-${index}`}
                  >
                    <button type="button" onClick={() => onSelect(item)}>
                      <strong>{item.title}</strong>
                      <span>
                        {item.roadAddress || item.address || '주소 정보 없음'}
                      </span>
                      <small>{item.category || '카테고리 정보 없음'}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  )
}
