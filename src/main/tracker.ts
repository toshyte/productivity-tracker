import { getActiveWindow } from './active-window'
import { isIdle } from './idle-detector'
import { insertEntry, updateEntryEndTime } from './database'
import { autoCategorizeNewApps } from './categories'

const POLL_INTERVAL_MS = 5_000
const IGNORED_APPS = new Set(['Electron', 'productivity-tracker', 'Productivity Tracker'])

interface CurrentEntry {
  appName: string
  windowTitle: string
  url: string
  isIdle: boolean
  dbId: number
}

let current: CurrentEntry | null = null
let intervalId: ReturnType<typeof setInterval> | null = null
let tracking = true

export function startTracking(): void {
  tracking = true
  tick()
  intervalId = setInterval(tick, POLL_INTERVAL_MS)
}

export function stopTracking(): void {
  tracking = false
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  finalizeCurrentEntry()
}

export function isTracking(): boolean {
  return tracking
}

export function toggleTracking(): boolean {
  if (tracking) {
    stopTracking()
  } else {
    startTracking()
  }
  return tracking
}

export function finalizeCurrentEntry(): void {
  if (current?.dbId) {
    updateEntryEndTime(current.dbId, new Date().toISOString())
  }
  current = null
}

async function tick(): Promise<void> {
  if (!tracking) return

  const now = new Date().toISOString()
  const idle = isIdle()

  let appName: string
  let windowTitle: string
  let url = ''

  if (idle) {
    appName = '__idle__'
    windowTitle = ''
  } else {
    const win = await getActiveWindow()
    if (!win) return
    if (IGNORED_APPS.has(win.appName)) return
    appName = win.appName
    windowTitle = win.windowTitle
    url = win.url || ''
  }

  // Same app AND same window title AND same idle state — just extend
  if (
    current &&
    current.appName === appName &&
    current.windowTitle === windowTitle &&
    current.isIdle === idle
  ) {
    updateEntryEndTime(current.dbId, now)
    return
  }

  // Something changed — finalize old, start new
  finalizeCurrentEntry()
  const dbId = insertEntry(appName, windowTitle, now, idle, url)
  current = { appName, windowTitle, url, isIdle: idle, dbId }

  // Auto-categorize if this is a new app
  autoCategorizeNewApps()
}
