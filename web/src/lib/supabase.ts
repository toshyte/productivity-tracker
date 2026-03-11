import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabase: SupabaseClient | null = null

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export function isConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    if (!isConfigured()) throw new Error('Supabase not configured')
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return supabase
}

// ── Types ───────────────────────────────────────────────

export interface TrackingEntry {
  id: number
  app_name: string
  window_title: string
  url: string
  start_time: string
  end_time: string
  duration_s: number
  is_idle: boolean
  user_id?: string
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

export interface AppCategory {
  app_name: string
  category: 'productive' | 'neutral' | 'distracting'
}

export interface UserProfile {
  user_id: string
  email: string
  display_name: string
  is_admin: boolean
}

export interface WebEvent {
  id: number
  site_id: string
  event_type: string
  page_url: string
  page_title: string
  element_tag: string
  element_text: string
  element_id: string
  element_class: string
  metadata: Record<string, unknown>
  created_at: string
  user_id?: string
}

// ── Auth ────────────────────────────────────────────────

export async function signIn(email: string, password: string): Promise<boolean> {
  if (!isConfigured()) return false
  try {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    return !error
  } catch {
    return false
  }
}

export async function getSession() {
  if (!isConfigured()) return null
  try {
    const { data } = await getSupabase().auth.getSession()
    return data.session
  } catch {
    return null
  }
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut()
}

// ── Users ───────────────────────────────────────────────

export async function getUsers(): Promise<UserProfile[]> {
  const { data } = await getSupabase()
    .from('profiles')
    .select('*')
    .order('display_name')
  return (data || []) as UserProfile[]
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await getSupabase().auth.getUser()
  if (!user) return null
  const { data } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()
  return data as UserProfile | null
}

// ── Tracking Entries (with optional user filter) ────────

export async function getTimeline(start: string, end: string, userId?: string): Promise<TrackingEntry[]> {
  let query = getSupabase()
    .from('tracking_entries')
    .select('*')
    .gte('start_time', start)
    .lt('start_time', end)
    .order('start_time')
  if (userId) query = query.eq('user_id', userId)
  const { data } = await query
  return (data || []) as TrackingEntry[]
}

export async function getAppSummary(start: string, end: string, userId?: string): Promise<AppSummary[]> {
  let query = getSupabase()
    .from('tracking_entries')
    .select('app_name, duration_s')
    .gte('start_time', start)
    .lt('start_time', end)
    .eq('is_idle', false)
  if (userId) query = query.eq('user_id', userId)
  const { data: entries } = await query

  const { data: cats } = await getSupabase().from('app_categories').select('*')
  const catMap: Record<string, string> = {}
  for (const c of cats || []) catMap[c.app_name] = c.category

  const grouped: Record<string, number> = {}
  for (const row of entries || []) {
    grouped[row.app_name] = (grouped[row.app_name] || 0) + row.duration_s
  }

  return Object.entries(grouped)
    .map(([app_name, total_seconds]) => ({
      app_name,
      total_seconds,
      category: (catMap[app_name] || 'neutral') as AppSummary['category']
    }))
    .sort((a, b) => b.total_seconds - a.total_seconds)
}

export async function getTrend(start: string, end: string, userId?: string): Promise<ProductivityTrend[]> {
  let query = getSupabase()
    .from('tracking_entries')
    .select('app_name, start_time, duration_s')
    .gte('start_time', start)
    .lt('start_time', end)
    .eq('is_idle', false)
  if (userId) query = query.eq('user_id', userId)
  const { data: entries } = await query

  const { data: cats } = await getSupabase().from('app_categories').select('*')
  const catMap: Record<string, string> = {}
  for (const c of cats || []) catMap[c.app_name] = c.category

  const grouped: Record<string, ProductivityTrend> = {}
  for (const row of entries || []) {
    const day = row.start_time.slice(0, 10)
    if (!grouped[day]) grouped[day] = { day, productive: 0, neutral: 0, distracting: 0 }
    const cat = (catMap[row.app_name] || 'neutral') as keyof Omit<ProductivityTrend, 'day'>
    grouped[day][cat] += row.duration_s
  }

  return Object.values(grouped).sort((a, b) => a.day.localeCompare(b.day))
}

export async function getAllApps(): Promise<AppCategory[]> {
  const { data } = await getSupabase().from('app_categories').select('*').order('app_name')
  return (data || []) as AppCategory[]
}

export async function setCategory(appName: string, category: string): Promise<void> {
  await getSupabase()
    .from('app_categories')
    .upsert({ app_name: appName, category }, { onConflict: 'app_name' })
}

// ── Web Events (with optional user filter) ──────────────

export async function getWebEvents(start: string, end: string, siteId?: string, userId?: string): Promise<WebEvent[]> {
  let query = getSupabase()
    .from('web_events')
    .select('*')
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: false })
    .limit(500)
  if (siteId) query = query.eq('site_id', siteId)
  if (userId) query = query.eq('user_id', userId)
  const { data } = await query
  return (data || []) as WebEvent[]
}

export async function getWebEventSites(): Promise<string[]> {
  const { data } = await getSupabase().from('web_events').select('site_id')
  const unique = new Set((data || []).map((d: { site_id: string }) => d.site_id))
  return Array.from(unique).sort()
}
