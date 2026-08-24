import { type FormEvent, useState } from 'react'
import type { NaverLocalSearchResponse } from '../types/naverSearch'

function removeHtmlTags(value: string) {
  return value.replace(/<[^>]*>/g, '')
}

export function RestaurantSearch() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<NaverLocalSearchResponse | null>(null)
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
      const body: unknown = await response.json()

      if (!response.ok) {
        const errorBody = body as { error?: { message?: string } }
        throw new Error(errorBody.error?.message ?? '검색 요청에 실패했습니다.')
      }

      setResult(body as NaverLocalSearchResponse)
    } catch (error) {
      setResult(null)
      setMessage(
        error instanceof Error ? error.message : '검색 중 오류가 발생했습니다.',
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
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? '검색 중…' : '검색'}
        </button>
      </form>

      {message && <p className="feedback" role="alert">{message}</p>}

      {result && (
        <div className="search-results" aria-live="polite">
          <p>{result.items.length}개의 결과를 찾았습니다.</p>
          <ul>
            {result.items.map((item) => (
              <li key={`${item.mapx}-${item.mapy}-${item.title}`}>
                <strong>{removeHtmlTags(item.title)}</strong>
                <span>{item.roadAddress || item.address}</span>
                <small>{item.category}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
