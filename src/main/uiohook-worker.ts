/**
 * uiohook child-process worker
 *
 * Runs uiohook-napi in an isolated process.
 * Captures actual keystrokes (key names), click positions, and scroll events.
 */

// Map uiohook keycodes to readable key names
const KEY_MAP: Record<number, string> = {
  1: 'Esc', 2: '1', 3: '2', 4: '3', 5: '4', 6: '5', 7: '6', 8: '7', 9: '8', 10: '9', 11: '0',
  12: '-', 13: '=', 14: 'Backspace', 15: 'Tab',
  16: 'q', 17: 'w', 18: 'e', 19: 'r', 20: 't', 21: 'y', 22: 'u', 23: 'i', 24: 'o', 25: 'p',
  26: '[', 27: ']', 28: 'Enter',
  29: 'Ctrl', 30: 'a', 31: 's', 32: 'd', 33: 'f', 34: 'g', 35: 'h', 36: 'j', 37: 'k', 38: 'l',
  39: ';', 40: "'", 41: '`',
  42: 'Shift', 43: '\\', 44: 'z', 45: 'x', 46: 'c', 47: 'v', 48: 'b', 49: 'n', 50: 'm',
  51: ',', 52: '.', 53: '/',
  54: 'RShift', 55: '*', 56: 'Alt', 57: 'Space', 58: 'CapsLock',
  59: 'F1', 60: 'F2', 61: 'F3', 62: 'F4', 63: 'F5', 64: 'F6', 65: 'F7', 66: 'F8', 67: 'F9', 68: 'F10',
  87: 'F11', 88: 'F12',
  3637: 'Cmd', 3638: 'Cmd', 3639: 'Cmd', 3640: 'Cmd', 3675: 'Cmd', 3676: 'Cmd',
  57416: 'Up', 57419: 'Left', 57421: 'Right', 57424: 'Down',
  57415: 'Home', 57417: 'PgUp', 57423: 'PgDn', 57420: 'End',
  57426: 'Insert', 57427: 'Delete'
}

const counts = { keystrokes: 0, clicks: 0, scrolls: 0 }
const recentKeys: string[] = []
let eventCount = 0

try {
  const { uIOhook, UiohookKey } = require('uiohook-napi')

  // Listen for ANY input event to verify uiohook is working
  uIOhook.on('input', (e: any) => {
    eventCount++
    if (eventCount <= 3) {
      process.send?.({ type: 'debug', message: `input event #${eventCount}: type=${e.type} keycode=${e.keycode || 'N/A'}` })
    }
  })

  uIOhook.on('keydown', (e: any) => {
    counts.keystrokes++
    const keyName = KEY_MAP[e.keycode] || `key${e.keycode}`
    recentKeys.push(keyName)
  })

  uIOhook.on('click', (e: any) => {
    counts.clicks++
    process.send?.({ type: 'click', x: e.x, y: e.y, button: e.button })
  })

  uIOhook.on('wheel', () => {
    counts.scrolls++
  })

  // Try to start uiohook - this is where it can fail silently
  try {
    uIOhook.start()
    process.send?.({ type: 'started' })
    process.send?.({ type: 'debug', message: 'uIOhook.start() completed successfully' })
  } catch (startErr: any) {
    process.send?.({ type: 'error', message: `uIOhook.start() failed: ${startErr?.message || startErr}` })
    process.exit(1)
  }

  // Heartbeat: report counts and event health every second
  let heartbeat = 0
  setInterval(() => {
    heartbeat++
    // Send counts if there's activity
    if (counts.keystrokes || counts.clicks || counts.scrolls) {
      process.send?.({ type: 'counts', ...counts })
      counts.keystrokes = 0
      counts.clicks = 0
      counts.scrolls = 0
    }
    // Send buffered keystrokes
    if (recentKeys.length > 0) {
      process.send?.({ type: 'keystrokes', keys: recentKeys.splice(0) })
    }
    // Send debug heartbeat every 30 seconds
    if (heartbeat % 30 === 0) {
      process.send?.({ type: 'debug', message: `heartbeat #${heartbeat}: total events captured so far: ${eventCount}` })
    }
  }, 1000)

  process.on('message', (msg: any) => {
    if (msg?.type === 'stop') {
      try { uIOhook.stop() } catch { /* ignore */ }
      process.exit(0)
    }
  })
} catch (err: any) {
  process.send?.({ type: 'error', message: err?.message || String(err) })
  process.exit(1)
}
