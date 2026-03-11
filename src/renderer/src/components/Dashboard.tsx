import React from 'react'
import Timeline from './Timeline'
import AppBreakdown from './AppBreakdown'
import ProductivityTrend from './ProductivityTrend'
import { useTrackingData } from '../hooks/useTrackingData'
import { formatDuration, percentOf } from '../lib/formatters'
import type { AppCategory } from '../../../shared/types'

interface DashboardProps {
  start: string
  end: string
  categories: AppCategory[]
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gap: '16px'
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px'
  },
  stat: {
    background: 'var(--bg-card)',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid var(--border)'
  },
  statLabel: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '4px'
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 700
  },
  chartsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px'
  },
  loading: {
    textAlign: 'center' as const,
    padding: '40px',
    color: 'var(--text-muted)'
  }
}

export default function Dashboard({ start, end, categories }: DashboardProps) {
  const { timeline, appSummary, trend, loading } = useTrackingData(start, end)

  if (loading) {
    return <div style={styles.loading}>Loading...</div>
  }

  const categoryMap: Record<string, string> = {}
  for (const c of categories) {
    categoryMap[c.app_name] = c.category
  }

  const totalTracked = appSummary.reduce((s, a) => s + a.total_seconds, 0)
  const totalProductive = appSummary
    .filter((a) => a.category === 'productive')
    .reduce((s, a) => s + a.total_seconds, 0)
  const totalDistracting = appSummary
    .filter((a) => a.category === 'distracting')
    .reduce((s, a) => s + a.total_seconds, 0)

  return (
    <div style={styles.grid}>
      <div style={styles.statsRow}>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Total Tracked</div>
          <div style={styles.statValue}>{formatDuration(totalTracked)}</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Productive</div>
          <div style={{ ...styles.statValue, color: 'var(--productive)' }}>
            {percentOf(totalProductive, totalTracked)}
          </div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Distracting</div>
          <div style={{ ...styles.statValue, color: 'var(--distracting)' }}>
            {percentOf(totalDistracting, totalTracked)}
          </div>
        </div>
      </div>

      <Timeline entries={timeline} categories={categoryMap} />

      <div style={styles.chartsRow}>
        <AppBreakdown data={appSummary} />
        <ProductivityTrend data={trend} />
      </div>
    </div>
  )
}
