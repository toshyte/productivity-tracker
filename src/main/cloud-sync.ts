import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getUnsyncedEntries, markEntriesSynced, getSetting, setSetting, getAllApps } from './database'

let supabase: SupabaseClient | null = null
let syncIntervalId: ReturnType<typeof setInterval> | null = null

const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

export async function initCloudSync(): Promise<void> {
  const url = getSetting('supabase_url')
  const key = getSetting('supabase_anon_key')
  const email = getSetting('supabase_email')
  const password = getSetting('supabase_password')

  if (!url || !key) {
    console.log('Supabase not configured — cloud sync disabled')
    return
  }

  supabase = createClient(url, key)

  if (email && password) {
    const ok = await authenticate(email, password)
    if (ok) {
      console.log('Supabase authenticated — cloud sync enabled')
    }
  } else {
    console.log('Supabase credentials missing — cloud sync disabled')
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
    console.error('Supabase auth failed:', error.message)
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
}

export function stopSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId)
    syncIntervalId = null
  }
}

async function syncToCloud(): Promise<void> {
  if (!supabase) return

  try {
    // Sync tracking entries
    const entries = getUnsyncedEntries()
    if (entries.length > 0) {
      const rows = entries.map((e) => ({
        app_name: e.app_name,
        window_title: e.window_title,
        url: (e as any).url || '',
        start_time: e.start_time,
        end_time: e.end_time,
        duration_s: e.duration_s,
        is_idle: !!e.is_idle
      }))

      const { error } = await supabase.from('tracking_entries').insert(rows)

      if (!error) {
        markEntriesSynced(entries.map((e) => e.id))
        console.log(`Synced ${entries.length} entries to cloud`)
      } else {
        console.error('Sync insert error:', error.message, error.details, error.hint)
      }
    }

    // Sync categories
    const categories = getAllApps()
    if (categories.length > 0) {
      const { error: catError } = await supabase.from('app_categories').upsert(
        categories.map((c) => ({
          app_name: c.app_name,
          category: c.category
        })),
        { onConflict: 'app_name,user_id' }
      )
      if (catError) {
        console.error('Category sync error:', catError.message)
      }
    }
  } catch (err) {
    console.error('Cloud sync failed:', err)
  }
}
