import React, { useState, useEffect } from 'react'

const GITHUB_RELEASE_BASE = 'https://github.com/toshyte/productivity-tracker/releases/download'

interface InstallerInfo {
  name: string
  url: string
  size: string
  icon: string
  description: string
  os: string
}

const INSTALLERS: InstallerInfo[] = [
  {
    name: 'macOS (Apple Silicon)',
    url: `${GITHUB_RELEASE_BASE}/v1.0.0/Productivity.Tracker-1.0.0-arm64.dmg`,
    size: '~330 MB',
    icon: '🍎',
    description: 'For MacBook Air/Pro M1, M2, M3, M4 and newer iMac/Mac mini',
    os: 'mac-arm'
  },
  {
    name: 'macOS (Intel)',
    url: `${GITHUB_RELEASE_BASE}/v1.0.0/Productivity.Tracker.Mac.Intel.dmg`,
    size: '~335 MB',
    icon: '🍏',
    description: 'For older MacBook, iMac, Mac mini with Intel processor',
    os: 'mac-intel'
  },
  {
    name: 'Windows',
    url: `${GITHUB_RELEASE_BASE}/v1.4.0/Productivity.Tracker.Setup.1.4.0.exe`,
    size: '~85 MB',
    icon: '🪟',
    description: 'Windows 10/11 (64-bit) — v1.4.0',
    os: 'windows'
  },
  {
    name: 'Android',
    url: `${GITHUB_RELEASE_BASE}/v1.0.0/Productivity.Tracker.Android.apk`,
    size: '~2.6 MB',
    icon: '🤖',
    description: 'Android 8.0+ — tracks app usage and syncs to cloud',
    os: 'android'
  }
]

function detectOS(): string {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('android')) return 'android'
  if (ua.includes('mac')) {
    // Can't reliably detect ARM vs Intel from UA alone
    return 'mac-arm'
  }
  if (ua.includes('win')) return 'windows'
  return ''
}

function getDownloadUrl(installer: InstallerInfo): string {
  return installer.url
}

export default function DownloadPage() {
  const [detectedOS, setDetectedOS] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    setDetectedOS(detectOS())
  }, [])

  // Sort so detected OS is first
  const sorted = [...INSTALLERS].sort((a, b) => {
    if (a.os === detectedOS) return -1
    if (b.os === detectedOS) return 1
    return 0
  })

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '60px 24px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)'
      }}
    >
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '48px', maxWidth: '600px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
        <h1
          style={{
            fontSize: '36px',
            fontWeight: 800,
            background: 'linear-gradient(to right, #6366f1, #8b5cf6, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '12px'
          }}
        >
          Productivity Tracker
        </h1>
        <p style={{ fontSize: '16px', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
          Track your app usage, keystrokes, clicks, and scrolls across all your devices.
          View everything in a beautiful cloud dashboard.
        </p>
      </div>

      {/* Download cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
          maxWidth: '800px',
          width: '100%'
        }}
      >
        {sorted.map((installer) => {
          const isRecommended = installer.os === detectedOS
          return (
            <div
              key={installer.os}
              style={{
                background: isRecommended ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255,255,255,0.04)',
                border: isRecommended ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                position: 'relative',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease'
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(99,102,241,0.15)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
              }}
            >
              {isRecommended && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '16px',
                    background: '#6366f1',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '10px',
                    textTransform: 'uppercase'
                  }}
                >
                  Recommended
                </div>
              )}
              <div style={{ fontSize: '36px' }}>{installer.icon}</div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#e2e8f0' }}>{installer.name}</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{installer.description}</div>
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>{installer.size}</div>
              <a
                href={getDownloadUrl(installer)}
                onClick={() => setDownloading(installer.os)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  background: isRecommended ? '#6366f1' : 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  marginTop: 'auto',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = isRecommended ? '#4f46e5' : 'rgba(255,255,255,0.12)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = isRecommended ? '#6366f1' : 'rgba(255,255,255,0.08)'
                }}
              >
                {downloading === installer.os ? '⏳ Downloading...' : '⬇️ Download'}
              </a>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ marginTop: '48px', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
        <p style={{ margin: '0 0 8px' }}>
          After installing, the app runs in the background and tracks your activity automatically.
        </p>
        <p style={{ margin: 0 }}>
          View your data at{' '}
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); window.location.hash = '' }}
            style={{ color: '#6366f1', textDecoration: 'underline' }}
          >
            the dashboard
          </a>
        </p>
      </div>
    </div>
  )
}
