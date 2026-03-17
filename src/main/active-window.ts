import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { ActiveWindow } from '../shared/types'

const execFileAsync = promisify(execFile)

// Browsers we can extract URLs from
const BROWSER_APPS = new Set([
  'Google Chrome', 'Safari', 'firefox', 'Firefox',
  'Arc', 'Brave Browser', 'Microsoft Edge', 'Opera', 'Vivaldi',
  'chrome', 'msedge', 'brave'
])

export async function getActiveWindow(): Promise<ActiveWindow | null> {
  if (process.platform === 'darwin') {
    return getActiveWindowMac()
  } else if (process.platform === 'win32') {
    return getActiveWindowWindows()
  }
  return null
}

async function getActiveWindowMac(): Promise<ActiveWindow | null> {
  try {
    // Single osascript call that gets both app name and window title
    const script = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  set winTitle to ""
  try
    set winTitle to name of front window of frontApp
  end try
  return appName & "|" & winTitle
end tell`
    const { stdout } = await execFileAsync('osascript', ['-e', script])
    const parts = stdout.trim().split('|')
    const appName = parts[0] || 'Unknown'
    const windowTitle = parts.slice(1).join('|') || ''

    // If window title is empty (no accessibility), try getting it from the app directly
    if (!windowTitle && appName) {
      try {
        const { stdout: title } = await execFileAsync('osascript', [
          '-e',
          `try
  tell application "${appName.replace(/"/g, '\\"')}" to get name of front window
end try`
        ])
        if (title.trim()) {
          const url = BROWSER_APPS.has(appName) ? await getBrowserUrlMac(appName) : ''
          return { appName, windowTitle: title.trim(), url }
        }
      } catch {
        // App doesn't support this — that's fine
      }
    }

    // Get URL if this is a browser
    const url = BROWSER_APPS.has(appName) ? await getBrowserUrlMac(appName) : ''

    return { appName, windowTitle, url }
  } catch {
    return null
  }
}

async function getBrowserUrlMac(appName: string): Promise<string> {
  try {
    let script = ''

    if (appName === 'Google Chrome' || appName === 'Brave Browser' || appName === 'Arc' || appName === 'Vivaldi' || appName === 'Microsoft Edge') {
      // Chromium-based browsers
      const browserName = appName === 'Arc' ? 'Arc' : appName
      script = `tell application "${browserName}" to get URL of active tab of front window`
    } else if (appName === 'Safari') {
      script = `tell application "Safari" to get URL of front document`
    } else if (appName === 'firefox' || appName === 'Firefox') {
      // Firefox doesn't support AppleScript URL access — use window title
      return ''
    }

    if (!script) return ''

    const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 2000 })
    return stdout.trim()
  } catch {
    return ''
  }
}

// ── Windows: compiled C# helper (no PowerShell!) ─────────────────

let helperExePath: string | null = null

async function ensureWindowsHelper(): Promise<string> {
  if (helperExePath && existsSync(helperExePath)) return helperExePath

  const userDataPath = app.getPath('userData')
  const exePath = join(userDataPath, 'get-window.exe')

  // If already compiled, reuse it
  if (existsSync(exePath)) {
    helperExePath = exePath
    return exePath
  }

  // Find the C# source — it's bundled alongside the app
  const csSource = join(__dirname, 'get-window.cs')

  // Find csc.exe (.NET Framework compiler, available on all Windows)
  const frameworkDir = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319'
  const cscPath = join(frameworkDir, 'csc.exe')

  if (!existsSync(cscPath)) {
    // Try 32-bit framework
    const csc32 = 'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe'
    if (!existsSync(csc32)) {
      throw new Error('csc.exe not found — .NET Framework 4 required')
    }
    await execFileAsync(csc32, ['/nologo', '/optimize', `/out:${exePath}`, csSource], { windowsHide: true })
  } else {
    await execFileAsync(cscPath, ['/nologo', '/optimize', `/out:${exePath}`, csSource], { windowsHide: true })
  }

  helperExePath = exePath
  return exePath
}

async function getActiveWindowWindows(): Promise<ActiveWindow | null> {
  try {
    const exePath = await ensureWindowsHelper()
    const { stdout } = await execFileAsync(exePath, [], {
      windowsHide: true,
      timeout: 5000
    })
    const parts = stdout.trim().split('|')
    const appName = parts[0] || 'Unknown'
    const windowTitle = parts.slice(1).join('|') || ''

    if (!appName || appName === 'Unknown') return null

    // Get URL for browsers on Windows (skip PowerShell-based URL detection for now)
    const url = ''

    return { appName, windowTitle, url }
  } catch {
    return null
  }
}
