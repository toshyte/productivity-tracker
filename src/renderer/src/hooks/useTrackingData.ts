import { useState, useEffect, useCallback } from 'react'
import { getDailyTimeline, getAppSummary, getProductivityTrend } from '../lib/ipc'
import type { TrackingEntry, AppSummary, ProductivityTrend } from '../../../shared/types'

interface TrackingData {
  timeline: TrackingEntry[]
  appSummary: AppSummary[]
  trend: ProductivityTrend[]
  loading: boolean
}

export function useTrackingData(start: string, end: string): TrackingData & { refresh: () => void } {
  const [data, setData] = useState<TrackingData>({
    timeline: [],
    appSummary: [],
    trend: [],
    loading: true
  })

  const fetchData = useCallback(async () => {
    setData((prev) => ({ ...prev, loading: true }))
    try {
      const [timeline, appSummary, trend] = await Promise.all([
        getDailyTimeline(start, end),
        getAppSummary(start, end),
        getProductivityTrend(start, end)
      ])
      setData({ timeline, appSummary, trend, loading: false })
    } catch (err) {
      console.error('Failed to fetch tracking data:', err)
      setData((prev) => ({ ...prev, loading: false }))
    }
  }, [start, end])

  useEffect(() => {
    fetchData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  return { ...data, refresh: fetchData }
}
