export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function formatHours(seconds: number): string {
  return (seconds / 3600).toFixed(1) + 'h'
}

export function todayRange(): [string, string] {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return [start.toISOString(), end.toISOString()]
}

export function weekRange(): [string, string] {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return [start.toISOString(), end.toISOString()]
}

export function monthRange(): [string, string] {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return [start.toISOString(), end.toISOString()]
}

export function categoryColor(category: string): string {
  switch (category) {
    case 'productive': return '#22c55e'
    case 'distracting': return '#ef4444'
    default: return '#6b7280'
  }
}

export function percentOf(part: number, total: number): string {
  if (total === 0) return '0%'
  return Math.round((part / total) * 100) + '%'
}
