import React from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { AppSummary } from '../../../shared/types'
import { categoryColor, formatDuration } from '../lib/formatters'

interface AppBreakdownProps {
  data: AppSummary[]
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
  }
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#f97316', '#eab308',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
]

export default function AppBreakdown({ data }: AppBreakdownProps) {
  if (data.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.title}>App Usage</div>
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
          No data yet
        </div>
      </div>
    )
  }

  // Show top 8, group rest as "Other"
  const top = data.slice(0, 8)
  const rest = data.slice(8)
  const chartData = [
    ...top.map((d) => ({ name: d.app_name, value: d.total_seconds, category: d.category })),
    ...(rest.length > 0
      ? [{ name: 'Other', value: rest.reduce((s, d) => s + d.total_seconds, 0), category: 'neutral' as const }]
      : [])
  ]

  return (
    <div style={styles.container}>
      <div style={styles.title}>App Usage</div>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            innerRadius={55}
            paddingAngle={2}
            stroke="none"
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: '#1a1d27',
              border: '1px solid #2a2d3a',
              borderRadius: '8px',
              color: '#e4e6eb',
              fontSize: '13px'
            }}
            formatter={(value: number) => formatDuration(value)}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', color: '#8b8fa3' }}
            formatter={(value) => <span style={{ color: '#8b8fa3' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
