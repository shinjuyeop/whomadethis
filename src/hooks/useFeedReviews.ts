import { useCallback, useEffect, useRef, useState } from 'react'
import { FEED_PAGE_SIZE, loadRecentReviewPage } from '../lib/feed'
import type { ActivityReview } from '../types/database'
import { useRealtime } from './useRealtime'

type FeedStatus = 'loading' | 'ready' | 'error'

export function useFeedReviews() {
  const { revision } = useRealtime()
  const [items, setItems] = useState<ActivityReview[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [status, setStatus] = useState<FeedStatus>('loading')
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const loadedCountRef = useRef(0)
  const initializedRef = useRef(false)
  const requestIdRef = useRef(0)

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current
    if (!initializedRef.current) setStatus('loading')
    setErrorMessage('')
    try {
      const page = await loadRecentReviewPage(
        Math.max(FEED_PAGE_SIZE, loadedCountRef.current),
        0,
      )
      if (requestId !== requestIdRef.current) return
      setItems(page.items)
      loadedCountRef.current = page.items.length
      setTotalCount(page.totalCount)
      setStatus('ready')
      initializedRef.current = true
    } catch {
      if (requestId !== requestIdRef.current) return
      setErrorMessage('최근 기록을 불러오지 못했습니다.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    const requestId = ++requestIdRef.current
    void loadRecentReviewPage(
      Math.max(FEED_PAGE_SIZE, loadedCountRef.current),
      0,
    )
      .then((page) => {
        if (requestId !== requestIdRef.current) return
        setItems(page.items)
        loadedCountRef.current = page.items.length
        setTotalCount(page.totalCount)
        setStatus('ready')
        initializedRef.current = true
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return
        setErrorMessage('최근 기록을 불러오지 못했습니다.')
        setStatus('error')
      })
  }, [revision])

  const loadMore = useCallback(async () => {
    if (isLoadingMore || loadedCountRef.current >= totalCount) return
    setIsLoadingMore(true)
    setErrorMessage('')
    try {
      const page = await loadRecentReviewPage(
        FEED_PAGE_SIZE,
        loadedCountRef.current,
      )
      setItems((current) => {
        const knownIds = new Set(current.map((item) => item.id))
        return [
          ...current,
          ...page.items.filter((item) => !knownIds.has(item.id)),
        ]
      })
      loadedCountRef.current += page.items.length
      if (page.items.length > 0) setTotalCount(page.totalCount)
    } catch {
      setErrorMessage('기록을 더 불러오지 못했습니다.')
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, totalCount])

  return {
    items,
    status,
    errorMessage,
    hasMore: items.length < totalCount,
    isLoadingMore,
    reload,
    loadMore,
  }
}
