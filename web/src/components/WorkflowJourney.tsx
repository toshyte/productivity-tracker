import type { TrackingEntry } from '../lib/supabase'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(s: number) {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function shortenUrl(url: string) {
  if (!url) return ''
  try {
    const u = new URL(url)
    return u.hostname + u.pathname.slice(0, 40)
  } catch {
    return url.slice(0, 50)
  }
}

const CAT_COLORS: Record<string, string> = {
  productive: '#22c55e',
  neutral: '#64748b',
  distracting: '#ef4444'
}

interface Props {
  timeline: TrackingEntry[]
  categories: Record<string, string>
}

export default function WorkflowJourney({ timeline, categories }: Props) {
  // Filter out idle and very short entries
  const steps = timeline.filter((e) => !e.is_idle && e.duration_s >= 5)

  if (steps.length === 0) {
    return (
      <div style={{ background: 'var(--card)', borderRadius: '8px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>Workflow Journey</h3>
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No activity yet</div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--card)', borderRadius: '8px', padding: '16px' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>Workflow Journey</h3>
      <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
        {steps.map((entry, i) => {
          const cat = categories[entry.app_name] || 'neutral'
          const color = CAT_COLORS[cat] || '#64748b'
          const isLast = i === steps.length - 1

          return (
            <div key={entry.id} style={{ display: 'flex', gap: '12px', minHeight: '48px' }}>
              {/* Timeline line + dot */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '20px',
                  flexShrink: 0
                }}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: color,
                    marginTop: '6px',
                    flexShrink: 0
                  }}
                />
                {!isLast && (
                  <div
                    style={{
                      width: '2px',
                      flexGrow: 1,
                      background: 'var(--border)',
                      minHeight: '20px'
                    }}
                  />
                )}
              </div>

              {/* Content */}
              <div style={{ paddingBottom: '12px', flexGrow: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{entry.app_name}</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                    {formatTime(entry.start_time)} &middot; {formatDuration(entry.duration_s)}
                  </span>
                </div>
                {entry.window_title && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: '2px'
                    }}
                  >
                    {entry.window_title}
                  </div>
                )}
                {entry.url && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#6366f1',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: '2px'
                    }}
                  >
                    {shortenUrl(entry.url)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
