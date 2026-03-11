export interface TrackingEntry {
  id: number
  app_name: string
  window_title: string
  start_time: string
  end_time: string
  duration_s: number
  is_idle: number
}

export interface AppCategory {
  app_name: string
  category: 'productive' | 'neutral' | 'distracting'
}

export interface AppSummary {
  app_name: string
  total_seconds: number
  category: 'productive' | 'neutral' | 'distracting'
}

export interface ProductivityTrend {
  day: string
  productive: number
  neutral: number
  distracting: number
}

export interface DashboardData {
  timeline: TrackingEntry[]
  appSummary: AppSummary[]
  trend: ProductivityTrend[]
  totalTracked: number
  totalProductive: number
  totalDistracting: number
}

export interface ActiveWindow {
  appName: string
  windowTitle: string
  url?: string
}

export interface ElectronAPI {
  getDailyTimeline(start: string, end: string): Promise<TrackingEntry[]>
  getAppSummary(start: string, end: string): Promise<AppSummary[]>
  getProductivityTrend(start: string, end: string): Promise<ProductivityTrend[]>
  getAllApps(): Promise<AppCategory[]>
  setAppCategory(appName: string, category: string): Promise<void>
  exportCSV(start: string, end: string): Promise<string | null>
  getTrackingStatus(): Promise<boolean>
  toggleTracking(): Promise<boolean>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
