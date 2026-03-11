import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import type { TrackingEntry, AppCategory, AppSummary, ProductivityTrend } from '../shared/types'

let db: Database.Database

export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'tracking.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS tracking_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name    TEXT    NOT NULL,
      window_title TEXT   NOT NULL DEFAULT '',
      url         TEXT    NOT NULL DEFAULT '',
      start_time  TEXT    NOT NULL,
      end_time    TEXT    NOT NULL,
      duration_s  INTEGER NOT NULL DEFAULT 0,
      is_idle     INTEGER NOT NULL DEFAULT 0,
      synced      INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_entries_start_time
      ON tracking_entries(start_time);

    CREATE INDEX IF NOT EXISTS idx_entries_app_name
      ON tracking_entries(app_name);

    CREATE INDEX IF NOT EXISTS idx_entries_synced
      ON tracking_entries(synced);

    CREATE TABLE IF NOT EXISTS app_categories (
      app_name    TEXT PRIMARY KEY,
      category    TEXT NOT NULL DEFAULT 'neutral'
        CHECK(category IN ('productive', 'neutral', 'distracting'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  // Migration: add url column if missing (for existing databases)
  try {
    db.exec(`ALTER TABLE tracking_entries ADD COLUMN url TEXT NOT NULL DEFAULT ''`)
  } catch {
    // Column already exists — ignore
  }
}

export function getDb(): Database.Database {
  return db
}

export function insertEntry(
  appName: string,
  windowTitle: string,
  startTime: string,
  isIdle: boolean,
  url: string = ''
): number {
  const stmt = db.prepare(`
    INSERT INTO tracking_entries (app_name, window_title, url, start_time, end_time, duration_s, is_idle)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `)
  const result = stmt.run(appName, windowTitle, url, startTime, startTime, isIdle ? 1 : 0)
  return Number(result.lastInsertRowid)
}

export function updateEntryEndTime(id: number, endTime: string): void {
  db.prepare(`
    UPDATE tracking_entries
    SET end_time = ?,
        duration_s = CAST((julianday(?) - julianday(start_time)) * 86400 AS INTEGER)
    WHERE id = ?
  `).run(endTime, endTime, id)
}

export function getDailyTimeline(start: string, end: string): TrackingEntry[] {
  return db.prepare(`
    SELECT id, app_name, window_title, start_time, end_time, duration_s, is_idle
    FROM tracking_entries
    WHERE start_time >= ? AND start_time < ?
    ORDER BY start_time
  `).all(start, end) as TrackingEntry[]
}

export function getAppSummary(start: string, end: string): AppSummary[] {
  return db.prepare(`
    SELECT
      e.app_name,
      SUM(e.duration_s) as total_seconds,
      COALESCE(c.category, 'neutral') as category
    FROM tracking_entries e
    LEFT JOIN app_categories c ON e.app_name = c.app_name
    WHERE e.start_time >= ? AND e.start_time < ?
      AND e.is_idle = 0
    GROUP BY e.app_name
    ORDER BY total_seconds DESC
  `).all(start, end) as AppSummary[]
}

export function getProductivityTrend(start: string, end: string): ProductivityTrend[] {
  const rows = db.prepare(`
    SELECT
      DATE(e.start_time) as day,
      COALESCE(c.category, 'neutral') as category,
      SUM(e.duration_s) as total_seconds
    FROM tracking_entries e
    LEFT JOIN app_categories c ON e.app_name = c.app_name
    WHERE e.start_time >= ? AND e.start_time < ?
      AND e.is_idle = 0
    GROUP BY day, category
    ORDER BY day
  `).all(start, end) as { day: string; category: string; total_seconds: number }[]

  const grouped: Record<string, ProductivityTrend> = {}
  for (const row of rows) {
    if (!grouped[row.day]) {
      grouped[row.day] = { day: row.day, productive: 0, neutral: 0, distracting: 0 }
    }
    const cat = row.category as keyof Omit<ProductivityTrend, 'day'>
    grouped[row.day][cat] = row.total_seconds
  }

  return Object.values(grouped)
}

export function getAllApps(): AppCategory[] {
  return db.prepare(`
    SELECT
      e.app_name,
      COALESCE(c.category, 'neutral') as category
    FROM (SELECT DISTINCT app_name FROM tracking_entries WHERE is_idle = 0) e
    LEFT JOIN app_categories c ON e.app_name = c.app_name
    ORDER BY e.app_name
  `).all() as AppCategory[]
}

export function setAppCategory(appName: string, category: string): void {
  db.prepare(`
    INSERT INTO app_categories (app_name, category)
    VALUES (?, ?)
    ON CONFLICT(app_name) DO UPDATE SET category = excluded.category
  `).run(appName, category)
}

export function getUnsyncedEntries(): (TrackingEntry & { synced: number })[] {
  return db.prepare(`
    SELECT * FROM tracking_entries WHERE synced = 0 AND duration_s > 0
    ORDER BY start_time LIMIT 500
  `).all() as (TrackingEntry & { synced: number })[]
}

export function markEntriesSynced(ids: number[]): void {
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(',')
  db.prepare(`UPDATE tracking_entries SET synced = 1 WHERE id IN (${placeholders})`).run(...ids)
}

export function getSetting(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    key,
    value
  )
}

export function getExportData(start: string, end: string): TrackingEntry[] {
  return db.prepare(`
    SELECT
      e.app_name,
      e.window_title,
      e.start_time,
      e.end_time,
      e.duration_s,
      e.is_idle,
      COALESCE(c.category, 'neutral') as category
    FROM tracking_entries e
    LEFT JOIN app_categories c ON e.app_name = c.app_name
    WHERE e.start_time >= ? AND e.start_time < ?
    ORDER BY e.start_time
  `).all(start, end) as TrackingEntry[]
}
