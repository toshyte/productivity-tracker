import React from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { ProductivityTrend as TrendData } from '../lib/supabase'

export default function ProductivityTrend({ data }: { data: TrendData[] }) {
  if (data.length === 0) {
    return (
      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Productivity Trend</div>
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No trend data yet</div>
      </div>
    )
  }

  const chartData = data.map((d) => ({
    day: d.day.slice(5),
    productive: d.productive / 3600,
    neutral: d.neutral / 3600,
    distracting: d.distracting / 3600
  }))

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Productivity Trend</div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis dataKey="day" stroke="#8b8fa3" fontSize={12} />
          <YAxis stroke="#8b8fa3" fontSize={12} tickFormatter={(v) => `${v}h`} />
          <Tooltip
            contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: '8px', color: '#e4e6eb', fontSize: '13px' }}
            formatter={(value) => `${Number(value).toFixed(1)}h`}
          />
          <Area type="monotone" dataKey="productive" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} name="Productive" />
          <Area type="monotone" dataKey="neutral" stackId="1" stroke="#6b7280" fill="#6b7280" fillOpacity={0.3} name="Neutral" />
          <Area type="monotone" dataKey="distracting" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} name="Distracting" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
