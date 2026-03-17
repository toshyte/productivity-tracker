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

const CS_SOURCE = `
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

class GetWindow {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

    static void Main() {
        try {
            IntPtr hwnd = GetForegroundWindow();
            if (hwnd == IntPtr.Zero) { Console.WriteLine("Unknown|"); return; }

            uint pid = 0;
            GetWindowThreadProcessId(hwnd, out pid);
            Process proc = Process.GetProcessById((int)pid);

            StringBuilder title = new StringBuilder(256);
            GetWindowText(hwnd, title, 256);

            string appName = proc.ProcessName;

            // Handle UWP apps (ApplicationFrameHost)
            if (appName == "ApplicationFrameHost") {
                EnumChildWindows(hwnd, (childHwnd, lParam) => {
                    uint childPid = 0;
                    GetWindowThreadProcessId(childHwnd, out childPid);
                    if (childPid != 0 && childPid != pid) {
                        try {
                            Process childProc = Process.GetProcessById((int)childPid);
                            if (childProc.ProcessName != "ApplicationFrameHost") {
                                proc = childProc;
                                appName = childProc.ProcessName;
                                return false;
                            }
                        } catch { }
                    }
                    return true;
                }, IntPtr.Zero);
            }

            // Try to get friendly name from FileDescription
            string friendly = appName;
            try {
                string desc = proc.MainModule.FileVersionInfo.FileDescription;
                if (!string.IsNullOrWhiteSpace(desc)) friendly = desc.Trim();
            } catch { }

            Console.WriteLine(friendly + "|" + title.ToString());
        } catch {
            Console.WriteLine("Unknown|");
        }
    }
}
`

let helperExePath: string | null = null

async function ensureWindowsHelper(): Promise<string> {
  if (helperExePath && existsSync(helperExePath)) return helperExePath

  const userDataPath = app.getPath('userData')
  const exePath = join(userDataPath, 'get-window.exe')
  const csPath = join(userDataPath, 'get-window.cs')

  // If already compiled, reuse it
  if (existsSync(exePath)) {
    helperExePath = exePath
    return exePath
  }

  // Write C# source to userData (not asar!)
  const { writeFileSync } = await import('fs')
  writeFileSync(csPath, CS_SOURCE, 'utf-8')

  // Find csc.exe (.NET Framework compiler, available on all Windows)
  const cscPaths = [
    'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe'
  ]

  let cscPath = ''
  for (const p of cscPaths) {
    if (existsSync(p)) { cscPath = p; break }
  }

  if (!cscPath) {
    throw new Error('csc.exe not found — .NET Framework 4 required')
  }

  await execFileAsync(cscPath, ['/nologo', '/optimize', `/out:${exePath}`, csPath], {
    windowsHide: true,
    timeout: 30000
  })

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
