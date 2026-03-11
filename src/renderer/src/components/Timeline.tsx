import React from 'react'
import type { TrackingEntry } from '../../../shared/types'
import { categoryColor, formatDuration } from '../lib/formatters'

interface TimelineProps {
  entries: TrackingEntry[]
  categories: Record<string, string>
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'var(--bg-card)',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid var(--border)'
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    marginBottom: '16px',
    color: 'var(--text)'
  },
  timeline: {
    display: 'flex',
    width: '100%',
    height: '40px',
    borderRadius: '8px',
    overflow: 'hidden',
    background: 'var(--bg)'
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '12px',
    marginTop: '12px',
    fontSize: '12px',
    color: 'var(--text-muted)'
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%'
  }
}

export default function Timeline({ entries, categories }: TimelineProps) {
  const activeEntries = entries.filter((e) => e.is_idle === 0 && e.duration_s > 0)
  const totalDuration = activeEntries.reduce((sum, e) => sum + e.duration_s, 0)

  if (activeEntries.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.title}>Activity Timeline</div>
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
          No activity recorded yet
        </div>
      </div>
    )
  }

  // Group small entries
  const minPercent = 0.5
  const displayEntries = activeEntries.filter((e) => (e.duration_s / totalDuration) * 100 >= minPercent)

  return (
    <div style={styles.container}>
      <div style={styles.title}>Activity Timeline</div>
      <div style={styles.timeline}>
        {displayEntries.map((entry, i) => {
          const cat = categories[entry.app_name] || 'neutral'
          const widthPct = (entry.duration_s / totalDuration) * 100
          return (
            <div
              key={i}
              title={`${entry.app_name}: ${formatDuration(entry.duration_s)}`}
              style={{
                width: `${widthPct}%`,
                background: categoryColor(cat),
                opacity: 0.85,
                transition: 'opacity 0.15s',
                cursor: 'pointer',
                borderRight: i < displayEntries.length - 1 ? '1px solid var(--bg)' : undefined
              }}
              onMouseEnter={(e) => {
                ;(e.target as HTMLElement).style.opacity = '1'
              }}
              onMouseLeave={(e) => {
                ;(e.target as HTMLElement).style.opacity = '0.85'
              }}
            />
          )
        })}
      </div>
      <div style={styles.legend}>
        {['productive', 'neutral', 'distracting'].map((cat) => (
          <div key={cat} style={styles.legendItem}>
            <div style={{ ...styles.dot, background: categoryColor(cat) }} />
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </div>
        ))}
      </div>
    </div>
  )
}
