/**
 * Activity Intensity Monitor (built into Electron)
 *
 * Tracks HOW ACTIVE the user is by counting:
 *   - keystrokes/min
 *   - clicks/min
 *   - scrolls/min
 *
 * Does NOT record what was typed or where was clicked.
 * Sends "activity_pulse" events to Supabase every 60 seconds.
 */

import { uIOhook, UiohookKeyboardEvent, UiohookMouseEvent, UiohookWheelEvent } from 'uiohook-napi'
import { getSetting } from './database'
import os from 'os'

const FLUSH_INTERVAL_MS = 60_000 // 1 minute

let counts = {
  keystrokes: 0,
  clicks: 0,
  scrolls: 0
}

let flushIntervalId: ReturnType<typeof setInterval> | null = null
let accessToken = ''
let supabaseUrl = ''
let supabaseKey = ''
let started = false

function getDeviceName(): string {
  return os.hostname() || 'unknown'
}

async function authenticate(): Promise<boolean> {
  const email = getSetting('supabase_email')
  const password = getSetting('supabase_password')

  if (!supabaseUrl || !supabaseKey || !email || !password) {
    return false
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseKey },
      body: JSON.stringify({ email, password })
    })
    if (res.ok) {
      const data = await res.json()
      accessToken = data.access_token
      console.log('[activity-monitor] Authenticated')
      return true
    }
    console.error('[activity-monitor] Auth failed:', res.status)
  } catch (err) {
    console.error('[activity-monitor] Auth error:', err)
  }
  return false
}

async function flush(): Promise<void> {
  // Snapshot and reset counts
  const snapshot = { ...counts }
  counts = { keystrokes: 0, clicks: 0, scrolls: 0 }

  const total = snapshot.keystrokes + snapshot.clicks + snapshot.scrolls
  if (total === 0) return // No activity — skip

  // Determine activity level
  let level: string
  if (total > 120) level = 'very_active'
  else if (total > 40) level = 'active'
  else if (total > 10) level = 'light'
  else level = 'minimal'

  const deviceName = getDeviceName()
  const event = {
    site_id: deviceName,
    event_type: 'activity_pulse',
    page_url: '',
    page_title: '',
    element_tag: level,
    element_text: '',
    element_id: '',
    element_class: '',
    metadata: {
      keystrokes_per_min: snapshot.keystrokes,
      clicks_per_min: snapshot.clicks,
      scrolls_per_min: snapshot.scrolls,
      total_actions: total,
      device: deviceName
    },
    created_at: new Date().toISOString()
  }

  if (!accessToken) {
    await authenticate()
    if (!accessToken) return
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/web_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'return=minimal'
      },
      body: JSON.stringify([event])
    })

    if (res.ok) {
      console.log(
        `[activity-monitor] keys=${snapshot.keystrokes} clicks=${snapshot.clicks} scrolls=${snapshot.scrolls} level=${level}`
      )
    } else {
      console.error('[activity-monitor] Flush failed:', res.status)
      if (res.status === 401) {
        await authenticate()
      }
    }
  } catch (err) {
    console.error('[activity-monitor] Flush error:', err)
  }
}

export function startActivityMonitor(): void {
  if (started) return

  supabaseUrl = getSetting('supabase_url') || ''
  supabaseKey = getSetting('supabase_anon_key') || ''

  if (!supabaseUrl || !supabaseKey) {
    console.log('[activity-monitor] Supabase not configured — activity monitor disabled')
    return
  }

  // Register uiohook listeners (only counts, never content)
  uIOhook.on('keydown', (_e: UiohookKeyboardEvent) => {
    counts.keystrokes++
  })

  uIOhook.on('click', (_e: UiohookMouseEvent) => {
    counts.clicks++
  })

  uIOhook.on('wheel', (_e: UiohookWheelEvent) => {
    counts.scrolls++
  })

  // Start the hook
  uIOhook.start()
  started = true

  // Authenticate and start flushing
  authenticate().then(() => {
    flushIntervalId = setInterval(flush, FLUSH_INTERVAL_MS)
    console.log('[activity-monitor] Started — tracking activity intensity')
  })
}

export function stopActivityMonitor(): void {
  if (!started) return

  flush() // Final flush
  if (flushIntervalId) {
    clearInterval(flushIntervalId)
    flushIntervalId = null
  }
  uIOhook.stop()
  started = false
  console.log('[activity-monitor] Stopped')
}
