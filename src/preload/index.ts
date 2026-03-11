import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '../shared/types'

const api: ElectronAPI = {
  getDailyTimeline: (start, end) => ipcRenderer.invoke('get-daily-timeline', start, end),
  getAppSummary: (start, end) => ipcRenderer.invoke('get-app-summary', start, end),
  getProductivityTrend: (start, end) => ipcRenderer.invoke('get-productivity-trend', start, end),
  getAllApps: () => ipcRenderer.invoke('get-all-apps'),
  setAppCategory: (appName, category) => ipcRenderer.invoke('set-app-category', appName, category),
  exportCSV: (start, end) => ipcRenderer.invoke('export-csv', start, end),
  getTrackingStatus: () => ipcRenderer.invoke('get-tracking-status'),
  toggleTracking: () => ipcRenderer.invoke('toggle-tracking')
}

contextBridge.exposeInMainWorld('electronAPI', api)
