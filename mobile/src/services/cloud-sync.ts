import { createClient, SupabaseClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getUnsyncedEntries, markEntriesSynced } from './database'

let supabase: SupabaseClient | null = null
let syncIntervalId: ReturnType<typeof setInterval> | null = null

const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

export async function initCloudSync(): Promise<void> {
  const url = await AsyncStorage.getItem('supabase_url')
  const key = await AsyncStorage.getItem('supabase_anon_key')

  if (!url || !key) {
    console.log('Supabase not configured')
    return
  }

  supabase = createClient(url, key)

  const email = await AsyncStorage.getItem('supabase_email')
  const password = await AsyncStorage.getItem('supabase_password')

  if (email && password) {
    await supabase.auth.signInWithPassword({ email, password })
    startSync()
  }
}

export async function configureAndLogin(
  url: string,
  anonKey: string,
  email: string,
  password: string
): Promise<boolean> {
  await AsyncStorage.setItem('supabase_url', url)
  await AsyncStorage.setItem('supabase_anon_key', anonKey)
  await AsyncStorage.setItem('supabase_email', email)
  await AsyncStorage.setItem('supabase_password', password)

  supabase = createClient(url, anonKey)
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.error('Auth failed:', error.message)
    return false
  }

  startSync()
  return true
}

function startSync(): void {
  if (syncIntervalId) clearInterval(syncIntervalId)
  syncIntervalId = setInterval(syncToCloud, SYNC_INTERVAL_MS)
  setTimeout(syncToCloud, 3000)
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
    const entries = await getUnsyncedEntries()
    if (entries.length === 0) return

    const rows = entries.map((e) => ({
      app_name: e.app_name,
      window_title: '',
      start_time: e.start_time,
      end_time: e.end_time,
      duration_s: e.duration_s,
      is_idle: e.is_idle === 1,
      device: 'android'
    }))

    const { error } = await supabase.from('tracking_entries').upsert(rows, {
      onConflict: 'start_time,app_name'
    })

    if (!error) {
      await markEntriesSynced(entries.map((e) => e.id))
      console.log(`Synced ${entries.length} entries`)
    } else {
      console.error('Sync error:', error.message)
    }
  } catch (err) {
    console.error('Cloud sync failed:', err)
  }
}

export function isConfigured(): boolean {
  return supabase !== null
}
