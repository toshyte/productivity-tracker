import { ipcMain } from 'electron'
import { getDailyTimeline, getAppSummary, getProductivityTrend, getAllApps, setAppCategory } from './database'
import { exportCSV } from './exporter'
import { isTracking, toggleTracking } from './tracker'

export function registerIpcHandlers(): void {
  ipcMain.handle('get-daily-timeline', (_event, start: string, end: string) => {
    return getDailyTimeline(start, end)
  })

  ipcMain.handle('get-app-summary', (_event, start: string, end: string) => {
    return getAppSummary(start, end)
  })

  ipcMain.handle('get-productivity-trend', (_event, start: string, end: string) => {
    return getProductivityTrend(start, end)
  })

  ipcMain.handle('get-all-apps', () => {
    return getAllApps()
  })

  ipcMain.handle('set-app-category', (_event, appName: string, category: string) => {
    setAppCategory(appName, category)
  })

  ipcMain.handle('export-csv', (_event, start: string, end: string) => {
    return exportCSV(start, end)
  })

  ipcMain.handle('get-tracking-status', () => {
    return isTracking()
  })

  ipcMain.handle('toggle-tracking', () => {
    return toggleTracking()
  })
}
