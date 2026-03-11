import React, { useState, useCallback } from 'react'
import DatePicker from './components/DatePicker'
import Dashboard from './components/Dashboard'
import ExportButton from './components/ExportButton'
import CategoryManager from './components/CategoryManager'
import { useCategories } from './hooks/useCategories'
import { todayRange, weekRange, monthRange } from './lib/formatters'

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: '100vh',
    padding: '24px 32px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  titleSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--text)'
  },
  actions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  catBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.15s'
  }
}

function getRange(range: string): [string, string] {
  switch (range) {
    case 'week':
      return weekRange()
    case 'month':
      return monthRange()
    default:
      return todayRange()
  }
}

export default function App() {
  const [activeRange, setActiveRange] = useState('today')
  const [showCategories, setShowCategories] = useState(false)
  const { categories, updateCategory } = useCategories()

  const [start, end] = getRange(activeRange)

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <div style={styles.titleSection}>
          <h1 style={styles.title}>Productivity Tracker</h1>
          <DatePicker activeRange={activeRange} onRangeChange={setActiveRange} />
        </div>
        <div style={styles.actions}>
          <button style={styles.catBtn} onClick={() => setShowCategories(true)}>
            Categories
          </button>
          <ExportButton start={start} end={end} />
        </div>
      </div>

      <Dashboard start={start} end={end} categories={categories} />

      <CategoryManager
        categories={categories}
        onUpdate={updateCategory}
        visible={showCategories}
        onClose={() => setShowCategories(false)}
      />
    </div>
  )
}
