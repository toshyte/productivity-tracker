import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getUnsyncedEntries, markEntriesSynced, getSetting, setSetting, getAllApps } from './database'
import { hostname } from 'os'
import { app } from 'electron'
import { appendFileSync } from 'fs'
import { join } from 'path'

let supabase: SupabaseClient | null = null
let syncIntervalId: ReturnType<typeof setInterval> | null = null

const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

// Built-in defaults — app works out of the box on any device, no config needed
const DEFAULT_SUPABASE_URL = 'https://zgipgqzskuzbtjldoezq.supabase.co'
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnaXBncXpza3V6YnRqbGRvZXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzA2OTQsImV4cCI6MjA4ODc0NjY5NH0.xLgdbbsc1H5YXn0QB5SalrrJcY-aeMFXRs7f5VuwImA'
const DEFAULT_PASSWORD = 'tracker2026'
// Each platform gets its own user
const DEFAULT_EMAIL = process.platform === 'win32' ? 'windows@tracker.local' : 'janis@tracker.local'

function syncLog(msg: string): void {
  const line = `[${new Date().toISOString()}] [cloud-sync] ${msg}\n`
  try {
    const logPath = join(app.getPath('userData'), 'activity-monitor.log')
    appendFileSync(logPath, line)
  } catch { /* ignore */ }
  console.log(`[cloud-sync] ${msg}`)
}

export async function initCloudSync(): Promise<void> {
  // Use saved settings, or fall back to built-in defaults
  const url = getSetting('supabase_url') || DEFAULT_SUPABASE_URL
  const key = getSetting('supabase_anon_key') || DEFAULT_SUPABASE_KEY
  const email = getSetting('supabase_email') || DEFAULT_EMAIL
  const password = getSetting('supabase_password') || DEFAULT_PASSWORD

  // Save defaults to DB on first run so activity-monitor can find them
  if (!getSetting('supabase_url')) {
    setSetting('supabase_url', url)
    setSetting('supabase_anon_key', key)
    setSetting('supabase_email', email)
    setSetting('supabase_password', password)
    syncLog('Saved built-in Supabase defaults to database')
  }

  supabase = createClient(url, key)

  const ok = await authenticate(email, password)
  if (ok) {
    syncLog(`Authenticated as ${email} — cloud sync enabled`)
  } else {
    syncLog(`Auth failed for ${email} — cloud sync disabled`)
  }
}

export function configureSupabase(url: string, anonKey: string, email: string, password: string): Promise<boolean> {
  setSetting('supabase_url', url)
  setSetting('supabase_anon_key', anonKey)
  setSetting('supabase_email', email)

  supabase = createClient(url, anonKey)

  return authenticate(email, password)
}

async function authenticate(email: string, password: string): Promise<boolean> {
  if (!supabase) return false

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    syncLog(`Auth error: ${error.message}`)
    return false
  }

  startSync()
  return true
}

function startSync(): void {
  if (syncIntervalId) clearInterval(syncIntervalId)
  syncIntervalId = setInterval(syncToCloud, SYNC_INTERVAL_MS)
  // Run initial sync after short delay
  setTimeout(syncToCloud, 5000)
  syncLog('Sync timer started (5s initial, then every 5min)')
}

export function stopSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId)
    syncIntervalId = null
  }
}

async function syncToCloud(): Promise<void> {
  if (!supabase) {
    syncLog('No Supabase client — skipping sync')
    return
  }

  try {
    // Get current user ID for RLS
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) {
      syncLog(`getUser error: ${userError.message}`)
      // Try to re-authenticate
      const email = getSetting('supabase_email') || DEFAULT_EMAIL
      const password = getSetting('supabase_password') || DEFAULT_PASSWORD
      syncLog('Attempting re-authentication...')
      const { error: reAuthError } = await supabase.auth.signInWithPassword({ email, password })
      if (reAuthError) {
        syncLog(`Re-auth failed: ${reAuthError.message}`)
        return
      }
      const { data: { user: reUser } } = await supabase.auth.getUser()
      if (!reUser?.id) {
        syncLog('Re-auth succeeded but still no user ID')
        return
      }
      syncLog(`Re-authenticated as user ${reUser.id}`)
      await doSync(reUser.id)
      return
    }

    const userId = user?.id
    if (!userId) {
      syncLog('No authenticated user — skipping sync')
      return
    }

    await doSync(userId)
  } catch (err) {
    syncLog(`Cloud sync crashed: ${err}`)
  }
}

async function doSync(userId: string): Promise<void> {
  if (!supabase) return

  // Sync tracking entries
  const entries = getUnsyncedEntries()
  syncLog(`Found ${entries.length} unsynced entries`)

  if (entries.length > 0) {
    const device = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'desktop' : 'linux'
    const deviceName = hostname() || device
    const rows = entries.map((e) => ({
      app_name: e.app_name,
      window_title: e.window_title,
      url: (e as any).url || '',
      start_time: e.start_time,
      end_time: e.end_time,
      duration_s: e.duration_s,
      is_idle: !!e.is_idle,
      user_id: userId,
      device,
      device_name: deviceName
    }))

    syncLog(`Inserting ${rows.length} entries (user=${userId}, device=${device})`)
    const { error } = await supabase.from('tracking_entries').insert(rows)

    if (!error) {
      markEntriesSynced(entries.map((e) => e.id))
      syncLog(`Synced ${entries.length} entries successfully`)
    } else {
      syncLog(`INSERT FAILED: ${error.message} | details: ${error.details} | hint: ${error.hint} | code: ${error.code}`)
    }
  }

  // Sync categories
  const categories = getAllApps()
  if (categories.length > 0) {
    const { error: catError } = await supabase.from('app_categories').upsert(
      categories.map((c) => ({
        app_name: c.app_name,
        category: c.category,
        user_id: userId
      })),
      { onConflict: 'app_name,user_id' }
    )
    if (catError) {
      syncLog(`Category sync error: ${catError.message}`)
    }
  }
}
