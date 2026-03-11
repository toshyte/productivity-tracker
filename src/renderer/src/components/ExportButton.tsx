import React, { useState } from 'react'
import { exportCSV } from '../lib/ipc'

interface ExportButtonProps {
  start: string
  end: string
}

const styles: Record<string, React.CSSProperties> = {
  button: {
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

export default function ExportButton({ start, end }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const path = await exportCSV(start, end)
      if (path) {
        console.log('Exported to:', path)
      }
    } catch (err) {
      console.error('Export failed:', err)
    }
    setExporting(false)
  }

  return (
    <button style={styles.button} onClick={handleExport} disabled={exporting}>
      {exporting ? 'Exporting...' : 'Export CSV'}
    </button>
  )
}
