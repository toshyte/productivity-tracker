import React from 'react'
import type { AppCategory } from '../../../shared/types'
import { categoryColor } from '../lib/formatters'

interface CategoryManagerProps {
  categories: AppCategory[]
  onUpdate: (appName: string, category: string) => void
  visible: boolean
  onClose: () => void
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100
  },
  panel: {
    background: 'var(--bg-card)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    width: '500px',
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)'
  },
  title: {
    fontSize: '16px',
    fontWeight: 600
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '20px',
    padding: '4px'
  },
  list: {
    overflowY: 'auto' as const,
    padding: '8px 0'
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 20px',
    borderBottom: '1px solid var(--border)'
  },
  appName: {
    fontSize: '14px',
    fontWeight: 500
  },
  select: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '13px'
  }
}

export default function CategoryManager({ categories, onUpdate, visible, onClose }: CategoryManagerProps) {
  if (!visible) return null

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Categorize Apps</span>
          <button style={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>
        <div style={styles.list}>
          {categories.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No apps tracked yet
            </div>
          )}
          {categories.map((app) => (
            <div key={app.app_name} style={styles.row}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: categoryColor(app.category)
                  }}
                />
                <span style={styles.appName}>{app.app_name}</span>
              </div>
              <select
                style={styles.select}
                value={app.category}
                onChange={(e) => onUpdate(app.app_name, e.target.value)}
              >
                <option value="productive">Productive</option>
                <option value="neutral">Neutral</option>
                <option value="distracting">Distracting</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
