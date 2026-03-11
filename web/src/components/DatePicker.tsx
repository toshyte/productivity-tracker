import React from 'react'

interface DatePickerProps {
  activeRange: string
  onRangeChange: (range: string) => void
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', gap: '8px' },
  button: {
    padding: '8px 16px',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '13px',
    fontWeight: 500
  },
  active: {
    background: 'var(--accent)',
    color: '#fff',
    borderColor: 'var(--accent)'
  }
}

export default function DatePicker({ activeRange, onRangeChange }: DatePickerProps) {
  const ranges = [
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'week' },
    { label: 'This Month', value: 'month' }
  ]

  return (
    <div style={styles.container}>
      {ranges.map((r) => (
        <button
          key={r.value}
          style={{ ...styles.button, ...(activeRange === r.value ? styles.active : {}) }}
          onClick={() => onRangeChange(r.value)}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
