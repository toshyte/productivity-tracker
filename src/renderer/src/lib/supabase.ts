import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { TrackingEntry, AppSummary, ProductivityTrend, AppCategory } from '../../../shared/types'

let supabase: SupabaseClient | null = null

export function initSupabase(url: string, anonKey: string): SupabaseClient {
  supabase = createClient(url, anonKey)
  return supabase
}

export function getSupabase(): SupabaseClient | null {
  return supabase
}

export async function supabaseGetTimeline(start: string, end: string): Promise<TrackingEntry[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('tracking_entries')
    .select('*')
    .gte('start_time', start)
    .lt('start_time', end)
    .order('start_time')
  return (data || []) as TrackingEntry[]
}

export async function supabaseGetAppSummary(start: string, end: string): Promise<AppSummary[]> {
  if (!supabase) return []
  // Use RPC or do client-side aggregation
  const { data } = await supabase
    .from('tracking_entries')
    .select('app_name, duration_s, is_idle')
    .gte('start_time', start)
    .lt('start_time', end)
    .eq('is_idle', false)

  if (!data) return []

  const { data: cats } = await supabase.from('app_categories').select('*')
  const catMap: Record<string, string> = {}
  for (const c of cats || []) {
    catMap[c.app_name] = c.category
  }

  const grouped: Record<string, number> = {}
  for (const row of data) {
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

export async function supabaseGetTrend(start: string, end: string): Promise<ProductivityTrend[]> {
  if (!supabase) return []

  const { data } = await supabase
    .from('tracking_entries')
    .select('app_name, start_time, duration_s, is_idle')
    .gte('start_time', start)
    .lt('start_time', end)
    .eq('is_idle', false)

  if (!data) return []

  const { data: cats } = await supabase.from('app_categories').select('*')
  const catMap: Record<string, string> = {}
  for (const c of cats || []) {
    catMap[c.app_name] = c.category
  }

  const grouped: Record<string, ProductivityTrend> = {}
  for (const row of data) {
    const day = row.start_time.slice(0, 10)
    if (!grouped[day]) {
      grouped[day] = { day, productive: 0, neutral: 0, distracting: 0 }
    }
    const cat = (catMap[row.app_name] || 'neutral') as keyof Omit<ProductivityTrend, 'day'>
    grouped[day][cat] += row.duration_s
  }

  return Object.values(grouped).sort((a, b) => a.day.localeCompare(b.day))
}

export async function supabaseGetAllApps(): Promise<AppCategory[]> {
  if (!supabase) return []
  const { data } = await supabase.from('app_categories').select('*').order('app_name')
  return (data || []) as AppCategory[]
}

export async function supabaseSetCategory(appName: string, category: string): Promise<void> {
  if (!supabase) return
  await supabase.from('app_categories').upsert({ app_name: appName, category }, { onConflict: 'app_name' })
}
