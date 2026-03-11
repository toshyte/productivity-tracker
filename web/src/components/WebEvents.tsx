import React, { useState, useEffect } from 'react'
import { getWebEvents, getWebEventSites, type WebEvent } from '../lib/supabase'

const EVENT_COLORS: Record<string, string> = {
  page_view: '#6366f1',
  click: '#22c55e',
  mouse_click: '#22c55e',
  keyboard_input: '#3b82f6',
  activity_pulse: '#f59e0b',
  form_submit: '#f59e0b',
  input_change: '#8b5cf6',
  js_error: '#ef4444',
  promise_rejection: '#ef4444'
}

function EventBadge({ type }: { type: string }) {
  const bg = EVENT_COLORS[type] || '#64748b'
  return (
    <span
      style={{
        background: bg + '22',
        color: bg,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: bg + '44',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap'
      }}
    >
      {type.replace(/_/g, ' ')}
    </span>
  )
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function shortenUrl(url: string) {
  try {
    const u = new URL(url)
    return u.pathname + u.search
  } catch {
    return url
  }
}

function getEventDetail(ev: WebEvent): string {
  if (ev.event_type === 'keyboard_input' && ev.metadata?.key_display) {
    return String(ev.metadata.key_display)
  }
  if (ev.event_type === 'mouse_click' && ev.metadata?.x_coordinate != null) {
    return `(${ev.metadata.x_coordinate}, ${ev.metadata.y_coordinate}) ${ev.element_text || ev.element_tag || ''}`
  }
  if (ev.event_type === 'activity_pulse' && ev.metadata) {
    const m = ev.metadata as Record<string, unknown>
    return `Keys: ${m.keyboard_count || 0} | Clicks: ${m.mouse_click_count || 0} | Scrolls: ${m.scroll_count || 0}`
  }
  return ev.element_text || ev.element_id || ev.element_tag || '\u2014'
}

interface Props {
  start: string
  end: string
  userId?: string
}

export default function WebEvents({ start, end, userId }: Props) {
  const [events, setEvents] = useState<WebEvent[]>([])
  const [sites, setSites] = useState<string[]>([])
  const [selectedSite, setSelectedSite] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    getWebEventSites().then(setSites)
  }, [])

  useEffect(() => {
    setLoading(true)
    getWebEvents(start, end, selectedSite || undefined, userId).then((data) => {
      setEvents(data)
      setLoading(false)
    })
  }, [start, end, selectedSite, userId])

  // Summary stats
  const totalEvents = events.length
  let totalKeyboardEvents = 0
  let totalMouseClicks = 0
  let totalActivityPulses = 0

  for (const e of events) {
    if (e.event_type === 'keyboard_input') totalKeyboardEvents++
    if (e.event_type === 'mouse_click') totalMouseClicks++
    if (e.event_type === 'activity_pulse') totalActivityPulses++
  }
  const uniquePages = new Set(events.map((e) => e.page_url)).size
  const errors = events.filter((e) => e.event_type === 'js_error' || e.event_type === 'promise_rejection').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '16px' }}>Web App Events</h3>
        {sites.length > 0 && (
          <select
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            style={{
              background: 'var(--card)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '13px'
            }}
          >
            <option value="">All sites</option>
            {sites.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        <div style={{ background: 'var(--card)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Total Events</div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{totalEvents}</div>
        </div>
        <div style={{ background: 'var(--card)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Keyboard Input</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#3b82f6' }}>{totalKeyboardEvents}</div>
        </div>
        <div style={{ background: 'var(--card)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Mouse Clicks</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#22c55e' }}>{totalMouseClicks}</div>
        </div>
        <div style={{ background: 'var(--card)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Pages Visited</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#6366f1' }}>{uniquePages}</div>
        </div>
        <div style={{ background: 'var(--card)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>JS Errors</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: errors > 0 ? '#ef4444' : '#22c55e' }}>
            {errors}
          </div>
        </div>
      </div>

      {/* Event list */}
      <div
        style={{
          background: 'var(--card)',
          borderRadius: '8px',
          padding: '16px',
          maxHeight: '500px',
          overflowY: 'auto'
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>Loading events...</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
            <div style={{ marginBottom: '8px' }}>No web events recorded yet</div>
            <div style={{ fontSize: '12px' }}>
              Add the tracking SDK to your web app to start capturing events
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '8px 4px', color: '#94a3b8', fontWeight: 500 }}>Time</th>
                <th style={{ padding: '8px 4px', color: '#94a3b8', fontWeight: 500 }}>Event</th>
                <th style={{ padding: '8px 4px', color: '#94a3b8', fontWeight: 500 }}>Details</th>
                <th style={{ padding: '8px 4px', color: '#94a3b8', fontWeight: 500 }}>Page</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <React.Fragment key={ev.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: expandedId === ev.id ? 'rgba(99,102,241,0.05)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '8px 4px', whiteSpace: 'nowrap', color: '#94a3b8' }}>
                      {formatTime(ev.created_at)}
                    </td>
                    <td style={{ padding: '8px 4px' }}>
                      <EventBadge type={ev.event_type} />
                    </td>
                    <td
                      style={{
                        padding: '8px 4px',
                        maxWidth: '250px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {getEventDetail(ev)}
                    </td>
                    <td
                      style={{
                        padding: '8px 4px',
                        maxWidth: '250px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: '#94a3b8'
                      }}
                    >
                      {ev.page_title || shortenUrl(ev.page_url) || '\u2014'}
                    </td>
                  </tr>
                  {expandedId === ev.id && (
                    <tr>
                      <td colSpan={4} style={{ padding: '8px 4px 16px', background: 'rgba(99,102,241,0.03)' }}>
                        <pre
                          style={{
                            margin: 0,
                            fontSize: '11px',
                            color: '#94a3b8',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all'
                          }}
                        >
                          {JSON.stringify(
                            {
                              site: ev.site_id,
                              url: ev.page_url,
                              title: ev.page_title,
                              element: {
                                tag: ev.element_tag,
                                id: ev.element_id,
                                class: ev.element_class,
                                text: ev.element_text
                              },
                              metadata: ev.metadata
                            },
                            null,
                            2
                          )}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
