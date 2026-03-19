/**
 * Activity Monitor (built into Electron)
 *
 * Tracks per-app activity including:
 *   - Actual keystrokes typed (key names)
 *   - Click positions (x, y)
 *   - Scroll counts
 *
 * Runs uiohook-napi in the MAIN process (not a child process) because macOS
 * Accessibility permission only applies to the main app binary, not helpers.
 *
 * REQUIRES Accessibility permission on macOS.
 */

import { join } from 'path'
import { systemPreferences, app } from 'electron'
import { getSetting } from './database'
import { getCurrentAppName } from './tracker'
import os from 'os'
import fs from 'fs'

const LOG_FILE = join(app.getPath('userData'), 'activity-monitor.log')

function logToFile(...args: unknown[]): void {
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { fs.appendFileSync(LOG_FILE, line) } catch { /* ignore */ }
  console.log(msg)
}

// Map uiohook keycodes to readable key names
const KEY_MAP: Record<number, string> = {
  1: 'Esc', 2: '1', 3: '2', 4: '3', 5: '4', 6: '5', 7: '6', 8: '7', 9: '8', 10: '9', 11: '0',
  12: '-', 13: '=', 14: 'Backspace', 15: 'Tab',
  16: 'q', 17: 'w', 18: 'e', 19: 'r', 20: 't', 21: 'y', 22: 'u', 23: 'i', 24: 'o', 25: 'p',
  26: '[', 27: ']', 28: 'Enter',
  29: 'Ctrl', 30: 'a', 31: 's', 32: 'd', 33: 'f', 34: 'g', 35: 'h', 36: 'j', 37: 'k', 38: 'l',
  39: ';', 40: "'", 41: '`',
  42: 'Shift', 43: '\\', 44: 'z', 45: 'x', 46: 'c', 47: 'v', 48: 'b', 49: 'n', 50: 'm',
  51: ',', 52: '.', 53: '/',
  54: 'RShift', 55: '*', 56: 'Alt', 57: 'Space', 58: 'CapsLock',
  59: 'F1', 60: 'F2', 61: 'F3', 62: 'F4', 63: 'F5', 64: 'F6', 65: 'F7', 66: 'F8', 67: 'F9', 68: 'F10',
  87: 'F11', 88: 'F12',
  3637: 'Cmd', 3638: 'Cmd', 3639: 'Cmd', 3640: 'Cmd', 3675: 'Cmd', 3676: 'Cmd',
  57416: 'Up', 57419: 'Left', 57421: 'Right', 57424: 'Down',
  57415: 'Home', 57417: 'PgUp', 57423: 'PgDn', 57420: 'End',
  57426: 'Insert', 57427: 'Delete'
}

const FLUSH_INTERVAL_MS = 60_000

interface AppActivity {
  keystrokes: number
  clicks: number
  scrolls: number
  typedKeys: string[]
  clickPositions: Array<{ x: number; y: number; button: number }>
}

let appData: Record<string, AppActivity> = {}

let uiohookInstance: any = null
let flushIntervalId: ReturnType<typeof setInterval> | null = null
let accessToken = ''
let userId = ''
let supabaseUrl = ''
let supabaseKey = ''
let started = false

function getDeviceName(): string {
  return os.hostname() || 'unknown'
}

function ensureApp(appName: string) {
  if (!appData[appName]) {
    appData[appName] = { keystrokes: 0, clicks: 0, scrolls: 0, typedKeys: [], clickPositions: [] }
  }
}

function keysToText(keys: string[]): string {
  const result: string[] = []
  for (const k of keys) {
    if (k === 'Space') result.push(' ')
    else if (k === 'Enter') result.push('\n')
    else if (k === 'Tab') result.push('\t')
    else if (k === 'Backspace') { result.pop(); continue }
    else if (k === 'Delete') continue
    else if (k.length === 1) result.push(k)
    else if (['Shift', 'RShift', 'Ctrl', 'Alt', 'Cmd', 'CapsLock'].includes(k)) continue
    else result.push(`[${k}]`)
  }
  return result.join('')
}

function getCurrentApp(): string {
  return getCurrentAppName() || 'Unknown'
}

async function authenticate(): Promise<boolean> {
  const email = getSetting('supabase_email')
  const password = getSetting('supabase_password')

  if (!supabaseUrl || !supabaseKey || !email || !password) {
    logToFile('[activity-monitor] Missing credentials')
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
      userId = data.user?.id || ''
      logToFile('[activity-monitor] Authenticated, user:', userId)
      return true
    }
    logToFile('[activity-monitor] Auth failed:', res.status)
  } catch (err) {
    logToFile('[activity-monitor] Auth error:', err)
  }
  return false
}

async function flush(): Promise<void> {
  const snapshot = { ...appData }
  appData = {}

  const deviceName = getDeviceName()
  const events: Array<Record<string, unknown>> = []

  for (const [appName, data] of Object.entries(snapshot)) {
    const total = data.keystrokes + data.clicks + data.scrolls
    if (total === 0) continue

    let level: string
    if (total > 120) level = 'very_active'
    else if (total > 40) level = 'active'
    else if (total > 10) level = 'light'
    else level = 'minimal'

    const typedText = keysToText(data.typedKeys)

    events.push({
      user_id: userId,
      site_id: deviceName,
      event_type: 'activity_pulse',
      page_url: '',
      page_title: appName,
      element_tag: level,
      element_text: typedText.slice(0, 2000),
      element_id: '',
      element_class: '',
      metadata: {
        app_name: appName,
        keystrokes_per_min: data.keystrokes,
        clicks_per_min: data.clicks,
        scrolls_per_min: data.scrolls,
        total_actions: total,
        typed_text: typedText.slice(0, 5000),
        click_positions: data.clickPositions.slice(0, 50),
        device: deviceName
      },
      created_at: new Date().toISOString()
    })
  }

  logToFile(`[activity-monitor] flush: ${events.length} events`)

  if (events.length === 0) return

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
      body: JSON.stringify(events)
    })

    if (res.ok) {
      for (const ev of events) {
        const m = ev.metadata as Record<string, unknown>
        const txt = String(m.typed_text || '').slice(0, 30)
        logToFile(`[activity-monitor] Sent: ${m.app_name}: k=${m.keystrokes_per_min} c=${m.clicks_per_min} s=${m.scrolls_per_min} text="${txt}"`)
      }
    } else {
      logToFile('[activity-monitor] Send failed:', res.status)
      if (res.status === 401) await authenticate()
    }
  } catch (err) {
    logToFile('[activity-monitor] Send error:', err)
  }
}

export function startActivityMonitor(): void {
  if (started) return

  if (process.platform === 'darwin') {
    const trusted = systemPreferences.isTrustedAccessibilityClient(false)
    if (!trusted) {
      logToFile('[activity-monitor] Accessibility not granted — disabled')
      return
    }
  }

  supabaseUrl = getSetting('supabase_url') || ''
  supabaseKey = getSetting('supabase_anon_key') || ''

  if (!supabaseUrl || !supabaseKey) {
    logToFile('[activity-monitor] Supabase not configured — disabled')
    return
  }

  try {
    // Load uiohook in the MAIN process (not a child process)
    // This is required because macOS Accessibility permission only applies
    // to the main app binary, not to forked helper processes
    const { uIOhook } = require('uiohook-napi')
    uiohookInstance = uIOhook

    let eventTotal = 0

    uIOhook.on('keydown', (e: any) => {
      eventTotal++
      const app = getCurrentApp()
      ensureApp(app)
      appData[app].keystrokes++
      const keyName = KEY_MAP[e.keycode] || `key${e.keycode}`
      appData[app].typedKeys.push(keyName)
    })

    uIOhook.on('click', (e: any) => {
      eventTotal++
      const app = getCurrentApp()
      ensureApp(app)
      appData[app].clicks++
      appData[app].clickPositions.push({ x: e.x, y: e.y, button: e.button || 1 })
    })

    uIOhook.on('wheel', () => {
      eventTotal++
      const app = getCurrentApp()
      ensureApp(app)
      appData[app].scrolls++
    })

    uIOhook.start()
    logToFile('[activity-monitor] uiohook started in main process')

    started = true

    // Authenticate and start flushing
    authenticate().then((ok) => {
      logToFile('[activity-monitor] Auth result:', ok)
      flushIntervalId = setInterval(flush, FLUSH_INTERVAL_MS)
      logToFile('[activity-monitor] Running — tracking keystrokes, clicks, scrolls per app')
    })
  } catch (err: any) {
    logToFile('[activity-monitor] Failed to start uiohook:', err?.message || err)
    logToFile('[activity-monitor] App continues without activity monitoring')
  }
}

export function stopActivityMonitor(): void {
  if (!started) return

  flush()
  if (flushIntervalId) {
    clearInterval(flushIntervalId)
    flushIntervalId = null
  }
  try {
    uiohookInstance?.stop()
  } catch { /* ignore */ }
  started = false
  logToFile('[activity-monitor] Stopped')
}
