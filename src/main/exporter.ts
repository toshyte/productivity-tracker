import { dialog } from 'electron'
import { writeFileSync } from 'fs'
import { getExportData } from './database'

export async function exportCSV(start: string, end: string): Promise<string | null> {
  const entries = getExportData(start, end)
  if (entries.length === 0) return null

  const header = 'App Name,Window Title,Start Time,End Time,Duration (s),Is Idle,Category'
  const rows = entries.map((e) => {
    const fields = [
      csvEscape(e.app_name),
      csvEscape(e.window_title),
      e.start_time,
      e.end_time,
      e.duration_s,
      e.is_idle ? 'Yes' : 'No',
      (e as Record<string, unknown>).category || 'neutral'
    ]
    return fields.join(',')
  })

  const csv = [header, ...rows].join('\n')

  const { filePath } = await dialog.showSaveDialog({
    defaultPath: `productivity-report-${start.slice(0, 10)}.csv`,
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  })

  if (filePath) {
    writeFileSync(filePath, csv, 'utf-8')
    return filePath
  }

  return null
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
