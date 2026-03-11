import UsageStats from '../native/UsageStats'
import { insertEntry, updateEntryEndTime } from './database'

const POLL_INTERVAL_MS = 5_000

interface CurrentEntry {
  appName: string
  dbId: number
}

let current: CurrentEntry | null = null
let intervalId: ReturnType<typeof setInterval> | null = null
let tracking = false

export function isTracking(): boolean {
  return tracking
}

export async function startTracking(): Promise<void> {
  const hasPermission = await UsageStats.hasPermission()
  if (!hasPermission) {
    UsageStats.requestPermission()
    return
  }

  tracking = true
  await tick()
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

function finalizeCurrentEntry(): void {
  if (current?.dbId) {
    updateEntryEndTime(current.dbId, new Date().toISOString())
  }
  current = null
}

async function tick(): Promise<void> {
  if (!tracking) return

  const now = new Date().toISOString()

  try {
    const result = await UsageStats.getForegroundApp()
    if (!result) return

    const appName = result.packageName

    // Same app — extend current entry
    if (current && current.appName === appName) {
      await updateEntryEndTime(current.dbId, now)
      return
    }

    // App changed — finalize old, start new
    finalizeCurrentEntry()
    const dbId = await insertEntry(appName, now, false)
    current = { appName, dbId }
  } catch (err) {
    console.error('Tracking tick failed:', err)
  }
}
