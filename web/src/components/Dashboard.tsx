import React, { useState, useEffect, useCallback } from 'react'
import Timeline from './Timeline'
import AppBreakdown from './AppBreakdown'
import ProductivityTrend from './ProductivityTrend'
import { getTimeline, getAppSummary, getTrend, getAllApps } from '../lib/supabase'
import type { TrackingEntry, AppSummary as AppSummaryT, ProductivityTrend as TrendT, AppCategory } from '../lib/supabase'
import ExportPanel from './ExportPanel'
import WorkflowJourney from './WorkflowJourney'
import { formatDuration, percentOf } from '../lib/formatters'

interface DashboardProps {
  start: string
  end: string
  userId?: string
}

export default function Dashboard({ start, end, userId }: DashboardProps) {
  const [timeline, setTimeline] = useState<TrackingEntry[]>([])
  const [summary, setSummary] = useState<AppSummaryT[]>([])
  const [trend, setTrend] = useState<TrendT[]>([])
  const [cats, setCats] = useState<AppCategory[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [t, s, tr, c] = await Promise.all([
      getTimeline(start, end, userId),
      getAppSummary(start, end, userId),
      getTrend(start, end, userId),
      getAllApps()
    ])
    setTimeline(t)
    setSummary(s)
    setTrend(tr)
    setCats(c)
    setLoading(false)
  }, [start, end, userId])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</div>
  }

  const catMap: Record<string, string> = {}
  for (const c of cats) catMap[c.app_name] = c.category

  const totalTracked = summary.reduce((s, a) => s + a.total_seconds, 0)
  const totalProductive = summary.filter((a) => a.category === 'productive').reduce((s, a) => s + a.total_seconds, 0)
  const totalDistracting = summary.filter((a) => a.category === 'distracting').reduce((s, a) => s + a.total_seconds, 0)

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <StatCard label="Total Tracked" value={formatDuration(totalTracked)} />
        <StatCard label="Productive" value={percentOf(totalProductive, totalTracked)} color="var(--productive)" />
        <StatCard label="Distracting" value={percentOf(totalDistracting, totalTracked)} color="var(--distracting)" />
      </div>
      <Timeline entries={timeline} categories={catMap} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <AppBreakdown data={summary} />
        <ProductivityTrend data={trend} />
      </div>
      <WorkflowJourney timeline={timeline} categories={catMap} />
      <ExportPanel timeline={timeline} summary={summary} trend={trend} categories={cats} start={start} end={end} />
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
    </div>
  )
}
