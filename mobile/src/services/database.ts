import SQLite from 'react-native-sqlite-storage'

SQLite.enablePromise(true)

let db: SQLite.SQLiteDatabase | null = null

export interface TrackingEntry {
  id: number
  app_name: string
  start_time: string
  end_time: string
  duration_s: number
  is_idle: number
  synced: number
}

export async function initDatabase(): Promise<void> {
  db = await SQLite.openDatabase({ name: 'tracking.db', location: 'default' })

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS tracking_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      app_name    TEXT    NOT NULL,
      start_time  TEXT    NOT NULL,
      end_time    TEXT    NOT NULL,
      duration_s  INTEGER NOT NULL DEFAULT 0,
      is_idle     INTEGER NOT NULL DEFAULT 0,
      synced      INTEGER NOT NULL DEFAULT 0
    )
  `)

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS app_categories (
      app_name    TEXT PRIMARY KEY,
      category    TEXT NOT NULL DEFAULT 'neutral'
    )
  `)
}

export async function insertEntry(appName: string, startTime: string, isIdle: boolean): Promise<number> {
  if (!db) throw new Error('Database not initialized')
  const [result] = await db.executeSql(
    'INSERT INTO tracking_entries (app_name, start_time, end_time, duration_s, is_idle) VALUES (?, ?, ?, 0, ?)',
    [appName, startTime, startTime, isIdle ? 1 : 0]
  )
  return result.insertId
}

export async function updateEntryEndTime(id: number, endTime: string): Promise<void> {
  if (!db) return
  await db.executeSql(
    `UPDATE tracking_entries
     SET end_time = ?,
         duration_s = CAST((julianday(?) - julianday(start_time)) * 86400 AS INTEGER)
     WHERE id = ?`,
    [endTime, endTime, id]
  )
}

export async function getUnsyncedEntries(): Promise<TrackingEntry[]> {
  if (!db) return []
  const [result] = await db.executeSql(
    'SELECT * FROM tracking_entries WHERE synced = 0 AND duration_s > 0 ORDER BY start_time LIMIT 500'
  )
  const entries: TrackingEntry[] = []
  for (let i = 0; i < result.rows.length; i++) {
    entries.push(result.rows.item(i))
  }
  return entries
}

export async function markEntriesSynced(ids: number[]): Promise<void> {
  if (!db || ids.length === 0) return
  const placeholders = ids.map(() => '?').join(',')
  await db.executeSql(
    `UPDATE tracking_entries SET synced = 1 WHERE id IN (${placeholders})`,
    ids
  )
}

export async function getTodayStats(): Promise<{ app_name: string; total_seconds: number }[]> {
  if (!db) return []
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

  const [result] = await db.executeSql(
    `SELECT app_name, SUM(duration_s) as total_seconds
     FROM tracking_entries
     WHERE start_time >= ? AND start_time < ? AND is_idle = 0
     GROUP BY app_name
     ORDER BY total_seconds DESC`,
    [start, end]
  )

  const stats: { app_name: string; total_seconds: number }[] = []
  for (let i = 0; i < result.rows.length; i++) {
    stats.push(result.rows.item(i))
  }
  return stats
}
