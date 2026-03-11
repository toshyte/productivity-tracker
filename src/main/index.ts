import { app, BrowserWindow, powerMonitor, systemPreferences } from 'electron'
import { join } from 'path'
import { initDatabase } from './database'
import { registerIpcHandlers } from './ipc-handlers'
import { createTray } from './tray'
import { startTracking, stopTracking, finalizeCurrentEntry } from './tracker'
import { initCloudSync, stopSync } from './cloud-sync'
import { autoCategorizeNewApps } from './categories'
import { startActivityMonitor, stopActivityMonitor } from './activity-monitor'

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: 'Productivity Tracker',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('close', (event) => {
    // Hide instead of close — keep running in tray
    event.preventDefault()
    mainWindow?.hide()
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Load the renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  // Check Accessibility permission (needed for window titles on macOS)
  if (process.platform === 'darwin') {
    const trusted = systemPreferences.isTrustedAccessibilityClient(true)
    if (!trusted) {
      console.log('Accessibility permission not granted — window titles will be limited')
    }
  }

  // Initialize database
  initDatabase()

  // Register IPC handlers
  registerIpcHandlers()

  // Create window
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
  startActivityMonitor()

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
  stopTracking()
  stopSync()
  stopActivityMonitor()
})
