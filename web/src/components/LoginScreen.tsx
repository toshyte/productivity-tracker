import React, { useState } from 'react'
import { signIn, isConfigured } from '../lib/supabase'

interface LoginScreenProps {
  onLogin: () => void
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh'
  },
  card: {
    background: 'var(--bg-card)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    padding: '32px',
    width: '360px'
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    marginBottom: '8px',
    textAlign: 'center' as const
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    marginBottom: '24px',
    textAlign: 'center' as const
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '14px',
    marginBottom: '12px',
    outline: 'none'
  },
  button: {
    width: '100%',
    padding: '10px',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    marginTop: '8px'
  },
  error: {
    color: 'var(--distracting)',
    fontSize: '13px',
    textAlign: 'center' as const,
    marginTop: '12px'
  }
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const ok = await signIn(email, password)
    if (ok) {
      onLogin()
    } else {
      setError('Invalid email or password')
    }
    setLoading(false)
  }

  const configured = isConfigured()

  return (
    <div style={styles.container}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <div style={styles.title}>Productivity Tracker</div>
        <div style={styles.subtitle}>Sign in to view your reports</div>
        {!configured && (
          <div style={{
            background: '#1e1b2e',
            border: '1px solid #6366f1',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#a5b4fc',
            lineHeight: '1.5'
          }}>
            Supabase not configured. Set <code style={{ background: '#0f1117', padding: '2px 4px', borderRadius: '4px' }}>VITE_SUPABASE_URL</code> and <code style={{ background: '#0f1117', padding: '2px 4px', borderRadius: '4px' }}>VITE_SUPABASE_ANON_KEY</code> in your .env file.
          </div>
        )}
        <input
          style={styles.input}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button style={styles.button} type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        {error && <div style={styles.error}>{error}</div>}
      </form>
    </div>
  )
}
