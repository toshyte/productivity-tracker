import React, { useState } from 'react'
import type { TrackingEntry, AppSummary, ProductivityTrend, AppCategory } from '../lib/supabase'
import { formatDuration } from '../lib/formatters'

interface ExportPanelProps {
  timeline: TrackingEntry[]
  summary: AppSummary[]
  trend: ProductivityTrend[]
  categories: AppCategory[]
  start: string
  end: string
}

const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer'
}

export default function ExportPanel({ timeline, summary, trend, categories, start, end }: ExportPanelProps) {
  const [copied, setCopied] = useState<string | null>(null)

  function generateSummaryText(): string {
    const totalTracked = summary.reduce((s, a) => s + a.total_seconds, 0)
    const productive = summary.filter(a => a.category === 'productive')
    const distracting = summary.filter(a => a.category === 'distracting')
    const neutral = summary.filter(a => a.category === 'neutral')
    const prodTotal = productive.reduce((s, a) => s + a.total_seconds, 0)
    const distTotal = distracting.reduce((s, a) => s + a.total_seconds, 0)

    const lines: string[] = []
    lines.push(`PRODUCTIVITY REPORT (${start.slice(0, 10)} to ${end.slice(0, 10)})`)
    lines.push(`Total tracked: ${formatDuration(totalTracked)}`)
    lines.push(`Productive: ${formatDuration(prodTotal)} (${totalTracked ? Math.round(prodTotal / totalTracked * 100) : 0}%)`)
    lines.push(`Distracting: ${formatDuration(distTotal)} (${totalTracked ? Math.round(distTotal / totalTracked * 100) : 0}%)`)
    lines.push('')

    if (productive.length > 0) {
      lines.push('PRODUCTIVE APPS:')
      productive.forEach(a => lines.push(`  ${a.app_name}: ${formatDuration(a.total_seconds)}`))
      lines.push('')
    }

    if (distracting.length > 0) {
      lines.push('DISTRACTING APPS:')
      distracting.forEach(a => lines.push(`  ${a.app_name}: ${formatDuration(a.total_seconds)}`))
      lines.push('')
    }

    if (neutral.length > 0) {
      lines.push('NEUTRAL APPS:')
      neutral.forEach(a => lines.push(`  ${a.app_name}: ${formatDuration(a.total_seconds)}`))
      lines.push('')
    }

    if (trend.length > 1) {
      lines.push('DAILY TREND:')
      trend.forEach(d => {
        lines.push(`  ${d.day}: productive ${formatDuration(d.productive)}, neutral ${formatDuration(d.neutral)}, distracting ${formatDuration(d.distracting)}`)
      })
    }

    lines.push('')
    lines.push('Please analyze my productivity patterns and suggest improvements.')

    return lines.join('\n')
  }

  function generateJSON(): string {
    return JSON.stringify({
      report_period: { start: start.slice(0, 10), end: end.slice(0, 10) },
      summary: {
        total_tracked_seconds: summary.reduce((s, a) => s + a.total_seconds, 0),
        apps: summary.map(a => ({
          name: a.app_name,
          seconds: a.total_seconds,
          category: a.category
        }))
      },
      daily_trend: trend,
      raw_entries: timeline.map(e => ({
        app: e.app_name,
        title: e.window_title,
        start: e.start_time,
        end: e.end_time,
        seconds: e.duration_s,
        idle: e.is_idle
      }))
    }, null, 2)
  }

  async function copyToClipboard(text: string, label: string) {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid var(--border)'
    }}>
      <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Export for AI Analysis</div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          style={btnStyle}
          onClick={() => copyToClipboard(generateSummaryText(), 'summary')}
        >
          {copied === 'summary' ? 'Copied!' : 'Copy Summary for AI'}
        </button>
        <button
          style={btnStyle}
          onClick={() => copyToClipboard(generateJSON(), 'json')}
        >
          {copied === 'json' ? 'Copied!' : 'Copy JSON for AI'}
        </button>
        <button
          style={btnStyle}
          onClick={() => downloadFile(generateJSON(), `productivity-${start.slice(0, 10)}.json`, 'application/json')}
        >
          Download JSON
        </button>
        <button
          style={btnStyle}
          onClick={() => {
            const header = 'App Name,Duration (s),Category'
            const rows = summary.map(a => `${a.app_name},${a.total_seconds},${a.category}`)
            downloadFile([header, ...rows].join('\n'), `productivity-${start.slice(0, 10)}.csv`, 'text/csv')
          }}
        >
          Download CSV
        </button>
      </div>
    </div>
  )
}
