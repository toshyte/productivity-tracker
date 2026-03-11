// Productivity Tracker — Chrome Extension Background Service Worker

const FLUSH_INTERVAL = 10000 // 10 seconds
let config = null
let accessToken = ''
let queue = []

// ── Config ──────────────────────────────────────────────

async function loadConfig() {
  const result = await chrome.storage.local.get(['supabaseUrl', 'supabaseKey', 'email', 'password'])
  if (result.supabaseUrl && result.supabaseKey) {
    config = result
    if (result.email && result.password) {
      await authenticate()
    }
  }
}

async function saveConfig(newConfig) {
  config = newConfig
  await chrome.storage.local.set(newConfig)
  if (newConfig.email && newConfig.password) {
    await authenticate()
  }
}

// ── Auth ────────────────────────────────────────────────

async function authenticate() {
  if (!config) return false
  try {
    const res = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: config.supabaseKey },
      body: JSON.stringify({ email: config.email, password: config.password })
    })
    if (res.ok) {
      const data = await res.json()
      accessToken = data.access_token
      console.log('[tracker] Authenticated')
      return true
    }
    console.error('[tracker] Auth failed:', res.status)
  } catch (err) {
    console.error('[tracker] Auth error:', err)
  }
  return false
}

// ── Event Queue ─────────────────────────────────────────

function enqueue(event) {
  queue.push({
    ...event,
    created_at: new Date().toISOString()
  })
}

async function flush() {
  if (queue.length === 0 || !accessToken || !config) return

  const batch = queue.splice(0, 100)

  try {
    const res = await fetch(`${config.supabaseUrl}/rest/v1/web_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.supabaseKey,
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(batch)
    })

    if (!res.ok) {
      console.error('[tracker] Flush failed:', res.status)
      queue.unshift(...batch)
      // Re-auth if 401
      if (res.status === 401) await authenticate()
    }
  } catch (err) {
    console.error('[tracker] Flush error:', err)
    queue.unshift(...batch)
  }
}

// ── Track tab changes ───────────────────────────────────

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    if (tab.url && !tab.url.startsWith('chrome://')) {
      enqueue({
        site_id: new URL(tab.url).hostname,
        event_type: 'tab_switch',
        page_url: tab.url,
        page_title: tab.title || '',
        element_tag: '',
        element_text: '',
        element_id: '',
        element_class: '',
        metadata: {}
      })
    }
  } catch {}
})

// Track page navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    enqueue({
      site_id: new URL(tab.url).hostname,
      event_type: 'page_view',
      page_url: tab.url,
      page_title: tab.title || '',
      element_tag: '',
      element_text: '',
      element_id: '',
      element_class: '',
      metadata: {}
    })
  }
})

// ── Messages from content script ────────────────────────

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'TRACK_EVENT') {
    enqueue(message.event)
  }
  if (message.type === 'GET_CONFIG') {
    return true // handled via sendResponse
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATUS') {
    sendResponse({
      configured: !!config,
      authenticated: !!accessToken,
      queueSize: queue.length
    })
    return true
  }
  if (message.type === 'SAVE_CONFIG') {
    saveConfig(message.config).then(() => {
      sendResponse({ success: true })
    })
    return true
  }
})

// ── Init ────────────────────────────────────────────────

loadConfig()

// Periodic flush
setInterval(flush, FLUSH_INTERVAL)

// Flush on startup
setTimeout(flush, 3000)
