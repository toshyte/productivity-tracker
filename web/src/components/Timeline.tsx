import React from 'react'
import type { TrackingEntry, AppCategory } from '../lib/supabase'
import { categoryColor, formatDuration } from '../lib/formatters'

interface TimelineProps {
  entries: TrackingEntry[]
  categories: Record<string, string>
}

export default function Timeline({ entries, categories }: TimelineProps) {
  const active = entries.filter((e) => !e.is_idle && e.duration_s > 0)
  const total = active.reduce((s, e) => s + e.duration_s, 0)

  if (active.length === 0) {
    return (
      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Activity Timeline</div>
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No activity recorded yet</div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Activity Timeline</div>
      <div style={{ display: 'flex', width: '100%', height: '40px', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg)' }}>
        {active.filter((e) => (e.duration_s / total) * 100 >= 0.5).map((entry, i) => {
          const cat = categories[entry.app_name] || 'neutral'
          return (
            <div
              key={i}
              title={`${entry.app_name}: ${formatDuration(entry.duration_s)}`}
              style={{
                width: `${(entry.duration_s / total) * 100}%`,
                background: categoryColor(cat),
                opacity: 0.85
              }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
        {['productive', 'neutral', 'distracting'].map((cat) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: categoryColor(cat) }} />
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </div>
        ))}
      </div>
    </div>
  )
}
