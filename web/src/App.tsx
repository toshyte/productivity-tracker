import React, { useState, useEffect } from 'react'
import LoginScreen from './components/LoginScreen'
import DatePicker from './components/DatePicker'
import Dashboard from './components/Dashboard'
import WebEvents from './components/WebEvents'
import { getSession, signOut, isConfigured } from './lib/supabase'
import { todayRange, weekRange, monthRange } from './lib/formatters'

function getRange(range: string): [string, string] {
  switch (range) {
    case 'week': return weekRange()
    case 'month': return monthRange()
    default: return todayRange()
  }
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [checking, setChecking] = useState(true)
  const [activeRange, setActiveRange] = useState('today')
  const [activeTab, setActiveTab] = useState<'desktop' | 'web'>('desktop')

  const configured = isConfigured()

  useEffect(() => {
    if (!configured) {
      setChecking(false)
      return
    }
    getSession().then((session) => {
      setLoggedIn(!!session)
      setChecking(false)
    })
  }, [configured])

  if (checking) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: 'var(--text-muted)' }}>Loading...</div>
  }

  if (!loggedIn) {
    return <LoginScreen onLogin={() => setLoggedIn(true)} />
  }

  const [start, end] = getRange(activeRange)

  const tabStyle = (tab: string) => ({
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    background: activeTab === tab ? 'var(--accent)' : 'transparent',
    color: activeTab === tab ? '#fff' : 'var(--text-muted)',
    fontSize: '13px',
    fontWeight: activeTab === tab ? 600 : 400,
    cursor: 'pointer' as const
  })

  return (
    <div style={{ minHeight: '100vh', padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Productivity Tracker</h1>
          <DatePicker activeRange={activeRange} onRangeChange={setActiveRange} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'var(--card)', borderRadius: '8px', padding: '3px' }}>
            <button onClick={() => setActiveTab('desktop')} style={tabStyle('desktop')}>Desktop</button>
            <button onClick={() => setActiveTab('web')} style={tabStyle('web')}>Web Events</button>
          </div>
          <button
            onClick={() => { signOut(); setLoggedIn(false) }}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px' }}
          >
            Sign Out
          </button>
        </div>
      </div>
      {activeTab === 'desktop' ? (
        <Dashboard start={start} end={end} />
      ) : (
        <WebEvents start={start} end={end} />
      )}
    </div>
  )
}
