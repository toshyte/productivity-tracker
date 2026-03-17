import { execFile } from 'child_process'
import { promisify } from 'util'
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

async function getActiveWindowWindows(): Promise<ActiveWindow | null> {
  try {
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;
public class Win32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);
}
"@
$hwnd = [Win32]::GetForegroundWindow()
$pid = 0
[Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
$proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
$title = New-Object System.Text.StringBuilder 256
[Win32]::GetWindowText($hwnd, $title, 256) | Out-Null

# Handle UWP apps (ApplicationFrameHost) — find the real child process
$appName = $proc.ProcessName
if ($appName -eq "ApplicationFrameHost") {
  $childPids = @{}
  $callback = [Win32+EnumWindowsProc]{
    param($childHwnd, $lParam)
    $childPid = 0
    [Win32]::GetWindowThreadProcessId($childHwnd, [ref]$childPid) | Out-Null
    if ($childPid -ne 0 -and $childPid -ne $pid) {
      $childPids[$childPid] = $true
    }
    return $true
  }
  [Win32]::EnumChildWindows($hwnd, $callback, [IntPtr]::Zero) | Out-Null
  foreach ($cpid in $childPids.Keys) {
    $childProc = Get-Process -Id $cpid -ErrorAction SilentlyContinue
    if ($childProc -and $childProc.ProcessName -ne "ApplicationFrameHost") {
      $proc = $childProc
      $appName = $childProc.ProcessName
      break
    }
  }
}

# Get a friendly name from FileDescription, fall back to ProcessName
$friendly = $appName
try {
  $desc = $proc.MainModule.FileVersionInfo.FileDescription
  if ($desc -and $desc.Trim() -ne "") { $friendly = $desc.Trim() }
} catch {}

"$friendly|$($title.ToString())"
`
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script
    ])
    const parts = stdout.trim().split('|')
    const appName = parts[0] || 'Unknown'
    const windowTitle = parts.slice(1).join('|') || ''

    // Get URL for browsers on Windows
    const url = BROWSER_APPS.has(appName) ? await getBrowserUrlWindows(appName) : ''

    return { appName, windowTitle, url }
  } catch {
    return null
  }
}

async function getBrowserUrlWindows(appName: string): Promise<string> {
  try {
    // Use UI Automation to read the address bar
    const script = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::FocusedElement
$walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
# Walk up to find the address bar
$el = $root
for ($i = 0; $i -lt 20; $i++) {
  if ($el -eq $null) { break }
  $name = $el.Current.Name
  $ctrl = $el.Current.ControlType.ProgrammaticName
  if ($ctrl -eq "ControlType.Edit" -and ($name -match "address|url|Address|URL|location")) {
    $val = $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    if ($val) { Write-Output $val.Current.Value; exit }
  }
  $el = $walker.GetParent($el)
}
# Fallback: search the window for edit controls
$window = [System.Windows.Automation.AutomationElement]::RootElement
$condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)
$edits = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
foreach ($edit in $edits) {
  if ($edit.Current.Name -match "address|url|Address|URL") {
    $val = $edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    if ($val) { Write-Output $val.Current.Value; exit }
  }
}
`
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command', script
    ], { timeout: 3000 })
    return stdout.trim()
  } catch {
    return ''
  }
}
