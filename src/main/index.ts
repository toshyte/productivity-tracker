import { app, BrowserWindow, dialog, powerMonitor, systemPreferences } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { initDatabase } from './database'
import { registerIpcHandlers } from './ipc-handlers'
import { createTray } from './tray'
import { startTracking, stopTracking, finalizeCurrentEntry } from './tracker'
import { initCloudSync, stopSync } from './cloud-sync'
import { autoCategorizeNewApps } from './categories'
import { startActivityMonitor, stopActivityMonitor } from './activity-monitor'

// Enforce single instance — if another copy is running, quit this one and focus the existing window
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let accessibilityPollId: ReturnType<typeof setInterval> | null = null
let isQuitting = false

function debugLog(msg: string): void {
  const line = `[${new Date().toISOString()}] [index] ${msg}\n`
  try {
    const logPath = join(app.getPath('userData'), 'activity-monitor.log')
    fs.appendFileSync(logPath, line)
  } catch { /* ignore */ }
  console.log(msg)
}

// Check if app was launched at login (auto-start)
const isAutoLaunch = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAtLogin

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Always start hidden — tray click will show
    title: 'Productivity Tracker',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      // Hide instead of close — keep running in tray
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  // Only show window on first launch (not auto-start)
  if (!isAutoLaunch) {
    mainWindow.on('ready-to-show', () => {
      mainWindow?.show()
    })
  }

  // Load the renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.on('second-instance', () => {
  if (mainWindow) {
    mainWindow.show()
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(() => {
  // ── Auto-start on boot ──────────────────────────────
  // Enable login item so the app starts automatically on boot
  try {
    const loginSettings = app.getLoginItemSettings()
    if (!loginSettings.openAtLogin) {
      if (process.platform === 'darwin') {
        app.setLoginItemSettings({
          openAtLogin: true,
          openAsHidden: true,
          args: ['--hidden']
        })
        debugLog('Auto-start enabled (macOS Login Items)')
      } else if (process.platform === 'win32') {
        app.setLoginItemSettings({
          openAtLogin: true,
          args: ['--hidden']
        })
        debugLog('Auto-start enabled (Windows Registry)')
      }
    } else {
      debugLog('Auto-start already configured')
    }
  } catch (err) {
    debugLog(`Auto-start setup error: ${err}`)
  }

  debugLog(`App started${isAutoLaunch ? ' (auto-launch, hidden mode)' : ' (manual launch)'}`)

  // Initialize database
  initDatabase()

  // Register IPC handlers
  registerIpcHandlers()

  // Create window (hidden if auto-launch)
  const win = createWindow()

  // Create system tray
  createTray(win)

  // Auto-categorize known apps
  autoCategorizeNewApps()

  // Start tracking
  startTracking()

  // Initialize cloud sync
  initCloudSync()

  // Start activity intensity monitor (keystrokes/clicks/scrolls per minute)
  // On macOS, poll for Accessibility permission — user may grant it after app starts
  if (process.platform === 'darwin') {
    // Don't prompt if auto-launched silently
    const promptUser = !isAutoLaunch
    const trusted = systemPreferences.isTrustedAccessibilityClient(promptUser)
    debugLog(`Accessibility check (initial): ${trusted}`)
    if (trusted) {
      debugLog('Accessibility permission already granted — starting activity monitor')
      startActivityMonitor()
    } else {
      debugLog('Accessibility not yet granted — will retry every 5s')
      if (!isAutoLaunch) {
        dialog.showMessageBox({
          type: 'info',
          title: 'Accessibility Permission Needed',
          message:
            'Productivity Tracker needs Accessibility permission to track keystrokes, clicks, and scrolls.\n\n' +
            'Go to: System Settings → Privacy & Security → Accessibility\n' +
            'Enable "Productivity Tracker".\n\n' +
            'The app will automatically start monitoring once permission is granted — no restart needed.',
          buttons: ['OK']
        })
      }
      // Poll every 5 seconds until permission is granted
      let pollCount = 0
      accessibilityPollId = setInterval(() => {
        pollCount++
        const nowTrusted = systemPreferences.isTrustedAccessibilityClient(false)
        if (pollCount % 12 === 0) {
          debugLog(`Accessibility poll #${pollCount}: ${nowTrusted}`)
        }
        if (nowTrusted) {
          debugLog('Accessibility permission granted! Starting activity monitor.')
          if (accessibilityPollId) {
            clearInterval(accessibilityPollId)
            accessibilityPollId = null
          }
          startActivityMonitor()
        }
      }, 5_000)
    }
  } else {
    // Windows — no Accessibility permission needed
    startActivityMonitor()
  }

  // Handle sleep/wake
  powerMonitor.on('suspend', () => {
    finalizeCurrentEntry()
  })

  powerMonitor.on('resume', () => {
    startTracking()
  })

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show()
    }
  })
})

// Keep app running when all windows are closed (tray mode)
app.on('window-all-closed', () => {
  // Do nothing — app stays in tray
})

app.on('before-quit', () => {
  isQuitting = true
  if (accessibilityPollId) {
    clearInterval(accessibilityPollId)
    accessibilityPollId = null
  }
  stopTracking()
  stopSync()
  stopActivityMonitor()
})
