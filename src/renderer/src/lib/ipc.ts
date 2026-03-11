import type { TrackingEntry, AppSummary, ProductivityTrend, AppCategory } from '../../../shared/types'

function api() {
  return window.electronAPI
}

export async function getDailyTimeline(start: string, end: string): Promise<TrackingEntry[]> {
  return api().getDailyTimeline(start, end)
}

export async function getAppSummary(start: string, end: string): Promise<AppSummary[]> {
  return api().getAppSummary(start, end)
}

export async function getProductivityTrend(start: string, end: string): Promise<ProductivityTrend[]> {
  return api().getProductivityTrend(start, end)
}

export async function getAllApps(): Promise<AppCategory[]> {
  return api().getAllApps()
}

export async function setAppCategory(appName: string, category: string): Promise<void> {
  return api().setAppCategory(appName, category)
}

export async function exportCSV(start: string, end: string): Promise<string | null> {
  return api().exportCSV(start, end)
}

export async function getTrackingStatus(): Promise<boolean> {
  return api().getTrackingStatus()
}

export async function toggleTracking(): Promise<boolean> {
  return api().toggleTracking()
}
