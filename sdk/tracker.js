/**
 * Productivity Tracker — Web Event SDK
 *
 * Drop this script into any web app to auto-track:
 *   - Page views (navigation + SPA route changes)
 *   - Button/link clicks
 *   - Form submissions
 *   - Custom events via window.tracker.track()
 *
 * Usage:
 *   <script src="tracker.js"
 *     data-supabase-url="https://your-project.supabase.co"
 *     data-supabase-key="your-anon-key"
 *     data-site-id="my-app">
 *   </script>
 *
 * Or init manually:
 *   window.tracker.init({ supabaseUrl, supabaseKey, siteId })
 *
 * Custom events:
 *   window.tracker.track('invoice_created', { amount: 500, client: 'Acme' })
 */
;(function () {
  'use strict'

  const BATCH_INTERVAL = 5000 // flush every 5s
  const MAX_BATCH = 50

  let supabaseUrl = ''
  let supabaseKey = ''
  let siteId = ''
  let sessionId = ''
  let accessToken = ''
  let queue = []
  let initialized = false
  let flushTimer = null

  // ── Helpers ──────────────────────────────────────────────

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  }

  function truncate(str, max) {
    return typeof str === 'string' ? str.slice(0, max) : ''
  }

  // ── Auth ─────────────────────────────────────────────────

  async function authenticate(email, password) {
    const res = await fetch(supabaseUrl + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey
      },
      body: JSON.stringify({ email, password })
    })
    if (!res.ok) {
      console.error('[tracker] Auth failed:', res.status)
      return false
    }
    const data = await res.json()
    accessToken = data.access_token
    return true
  }

  // ── Event Queue ──────────────────────────────────────────

  function enqueue(eventType, detail) {
    if (!initialized) return

    const event = {
      site_id: siteId,
      event_type: eventType,
      page_url: truncate(window.location.href, 2000),
      page_title: truncate(document.title, 500),
      element_tag: truncate(detail.tag || '', 50),
      element_text: truncate(detail.text || '', 200),
      element_id: truncate(detail.id || '', 200),
      element_class: truncate(detail.className || '', 500),
      metadata: detail.metadata || {},
      created_at: new Date().toISOString()
    }

    queue.push(event)

    if (queue.length >= MAX_BATCH) {
      flush()
    }
  }

  async function flush() {
    if (queue.length === 0 || !accessToken) return

    const batch = queue.splice(0, MAX_BATCH)

    try {
      const res = await fetch(supabaseUrl + '/rest/v1/web_events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: 'Bearer ' + accessToken,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(batch)
      })

      if (!res.ok) {
        // Put events back on retry
        console.error('[tracker] Flush failed:', res.status)
        queue.unshift(...batch)
      }
    } catch (err) {
      console.error('[tracker] Flush error:', err)
      queue.unshift(...batch)
    }
  }

  // ── Auto-tracking ────────────────────────────────────────

  function trackPageView() {
    enqueue('page_view', {})
  }

  function trackClicks() {
    document.addEventListener(
      'click',
      function (e) {
        const el = e.target.closest('button, a, [role="button"], input[type="submit"], [data-track]')
        if (!el) return

        enqueue('click', {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().slice(0, 200),
          id: el.id || '',
          className: el.className || '',
          metadata: {
            href: el.href || '',
            type: el.type || '',
            dataTrack: el.dataset.track || ''
          }
        })
      },
      true
    )
  }

  function trackForms() {
    document.addEventListener(
      'submit',
      function (e) {
        const form = e.target
        if (form.tagName !== 'FORM') return

        // Collect field names (not values — privacy!)
        const fields = Array.from(form.elements)
          .filter(function (el) {
            return el.name && el.type !== 'hidden' && el.type !== 'password'
          })
          .map(function (el) {
            return el.name
          })

        enqueue('form_submit', {
          tag: 'form',
          id: form.id || '',
          className: form.className || '',
          metadata: {
            action: form.action || '',
            method: form.method || '',
            fields: fields
          }
        })
      },
      true
    )
  }

  function trackSPANavigation() {
    // Detect SPA route changes via pushState/replaceState
    var origPush = history.pushState
    var origReplace = history.replaceState

    history.pushState = function () {
      origPush.apply(this, arguments)
      setTimeout(trackPageView, 50)
    }

    history.replaceState = function () {
      origReplace.apply(this, arguments)
      setTimeout(trackPageView, 50)
    }

    window.addEventListener('popstate', function () {
      setTimeout(trackPageView, 50)
    })
  }

  function trackInputChanges() {
    document.addEventListener(
      'change',
      function (e) {
        const el = e.target
        if (!el || !el.tagName) return
        const tag = el.tagName.toLowerCase()
        if (tag !== 'select' && tag !== 'input' && tag !== 'textarea') return

        // Only track the field name, NOT the value (privacy)
        enqueue('input_change', {
          tag: tag,
          id: el.id || '',
          className: el.className || '',
          metadata: {
            name: el.name || '',
            type: el.type || '',
            // For selects, track which option label was picked
            selectedLabel: tag === 'select' && el.selectedIndex >= 0
              ? (el.options[el.selectedIndex].text || '').slice(0, 100)
              : ''
          }
        })
      },
      true
    )
  }

  function trackErrors() {
    window.addEventListener('error', function (e) {
      enqueue('js_error', {
        metadata: {
          message: (e.message || '').slice(0, 500),
          filename: (e.filename || '').slice(0, 500),
          line: e.lineno,
          col: e.colno
        }
      })
    })

    window.addEventListener('unhandledrejection', function (e) {
      enqueue('promise_rejection', {
        metadata: {
          reason: String(e.reason || '').slice(0, 500)
        }
      })
    })
  }

  // ── Public API ───────────────────────────────────────────

  async function init(config) {
    supabaseUrl = config.supabaseUrl || ''
    supabaseKey = config.supabaseKey || ''
    siteId = config.siteId || window.location.hostname

    if (!supabaseUrl || !supabaseKey) {
      console.error('[tracker] Missing supabaseUrl or supabaseKey')
      return
    }

    // Authenticate
    if (config.email && config.password) {
      const ok = await authenticate(config.email, config.password)
      if (!ok) return
    } else if (config.accessToken) {
      accessToken = config.accessToken
    } else {
      console.error('[tracker] Missing auth credentials (email+password or accessToken)')
      return
    }

    sessionId = generateId()
    initialized = true

    // Start auto-tracking
    trackClicks()
    trackForms()
    trackInputChanges()
    trackSPANavigation()
    trackErrors()
    trackPageView()

    // Periodic flush
    flushTimer = setInterval(flush, BATCH_INTERVAL)

    // Flush on page hide
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush()
    })
    window.addEventListener('beforeunload', flush)

    console.log('[tracker] Initialized for site:', siteId)
  }

  function track(eventName, metadata) {
    enqueue(eventName, { metadata: metadata || {} })
  }

  // ── Auto-init from script tag ────────────────────────────

  var script = document.currentScript
  if (script) {
    var url = script.getAttribute('data-supabase-url')
    var key = script.getAttribute('data-supabase-key')
    var site = script.getAttribute('data-site-id')
    var email = script.getAttribute('data-email')
    var password = script.getAttribute('data-password')

    if (url && key && email && password) {
      init({
        supabaseUrl: url,
        supabaseKey: key,
        siteId: site || window.location.hostname,
        email: email,
        password: password
      })
    }
  }

  // ── Expose globally ──────────────────────────────────────

  window.tracker = {
    init: init,
    track: track,
    flush: flush
  }
})()
