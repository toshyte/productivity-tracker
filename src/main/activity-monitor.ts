/**
 * Activity Monitor
 *
 * Tracks per-app activity including:
 *   - Keystrokes count
 *   - Click count
 *   - Scroll count
 *
 * macOS: uses uiohook-napi in the MAIN process (Accessibility permission required)
 * Windows: uses a compiled C# helper with SetWindowsHookEx (no special permissions)
 */

import { join } from 'path'
import { systemPreferences, app } from 'electron'
import { getSetting } from './database'
import { getCurrentAppName } from './tracker'
import { execFile, ChildProcess } from 'child_process'
import { promisify } from 'util'
import { existsSync, writeFileSync } from 'fs'
import os from 'os'
import fs from 'fs'

const execFileAsync = promisify(execFile)
const LOG_FILE = join(app.getPath('userData'), 'activity-monitor.log')

function logToFile(...args: unknown[]): void {
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { fs.appendFileSync(LOG_FILE, line) } catch { /* ignore */ }
  console.log(msg)
}

// Map uiohook keycodes to readable key names (macOS only)
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

const FLUSH_INTERVAL_MS = 60_000

interface AppActivity {
  keystrokes: number
  clicks: number
  scrolls: number
  typedKeys: string[]
  clickPositions: Array<{ x: number; y: number; button: number }>
}

let appData: Record<string, AppActivity> = {}

let uiohookInstance: any = null
let winInputProcess: ChildProcess | null = null
let flushIntervalId: ReturnType<typeof setInterval> | null = null
let accessToken = ''
let userId = ''
let supabaseUrl = ''
let supabaseKey = ''
let started = false

function getDeviceName(): string {
  return os.hostname() || 'unknown'
}

function ensureApp(appName: string) {
  if (!appData[appName]) {
    appData[appName] = { keystrokes: 0, clicks: 0, scrolls: 0, typedKeys: [], clickPositions: [] }
  }
}

function keysToText(keys: string[]): string {
  const result: string[] = []
  for (const k of keys) {
    if (k === 'Space') result.push(' ')
    else if (k === 'Enter') result.push('\n')
    else if (k === 'Tab') result.push('\t')
    else if (k === 'Backspace') { result.pop(); continue }
    else if (k === 'Delete') continue
    else if (k.length === 1) result.push(k)
    else if (['Shift', 'RShift', 'Ctrl', 'Alt', 'Cmd', 'CapsLock'].includes(k)) continue
    else result.push(`[${k}]`)
  }
  return result.join('')
}

function getCurrentApp(): string {
  return getCurrentAppName() || 'Unknown'
}

async function authenticate(): Promise<boolean> {
  const email = getSetting('supabase_email')
  const password = getSetting('supabase_password')

  if (!supabaseUrl || !supabaseKey || !email || !password) {
    logToFile('[activity-monitor] Missing credentials')
    return false
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseKey },
      body: JSON.stringify({ email, password })
    })
    if (res.ok) {
      const data = await res.json()
      accessToken = data.access_token
      userId = data.user?.id || ''
      logToFile('[activity-monitor] Authenticated, user:', userId)
      return true
    }
    logToFile('[activity-monitor] Auth failed:', res.status)
  } catch (err) {
    logToFile('[activity-monitor] Auth error:', err)
  }
  return false
}

async function flush(): Promise<void> {
  const snapshot = { ...appData }
  appData = {}

  const deviceName = getDeviceName()
  const events: Array<Record<string, unknown>> = []

  for (const [appName, data] of Object.entries(snapshot)) {
    const total = data.keystrokes + data.clicks + data.scrolls
    if (total === 0) continue

    let level: string
    if (total > 120) level = 'very_active'
    else if (total > 40) level = 'active'
    else if (total > 10) level = 'light'
    else level = 'minimal'

    const typedText = keysToText(data.typedKeys)

    events.push({
      user_id: userId,
      site_id: deviceName,
      event_type: 'activity_pulse',
      page_url: '',
      page_title: appName,
      element_tag: level,
      element_text: typedText.slice(0, 2000),
      element_id: '',
      element_class: '',
      metadata: {
        app_name: appName,
        keystrokes_per_min: data.keystrokes,
        clicks_per_min: data.clicks,
        scrolls_per_min: data.scrolls,
        total_actions: total,
        typed_text: typedText.slice(0, 5000),
        click_positions: data.clickPositions.slice(0, 50),
        device: deviceName
      },
      created_at: new Date().toISOString()
    })
  }

  logToFile(`[activity-monitor] flush: ${events.length} events`)

  if (events.length === 0) return

  if (!accessToken) {
    await authenticate()
    if (!accessToken) return
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/web_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(events)
    })

    if (res.ok) {
      for (const ev of events) {
        const m = ev.metadata as Record<string, unknown>
        const txt = String(m.typed_text || '').slice(0, 30)
        logToFile(`[activity-monitor] Sent: ${m.app_name}: k=${m.keystrokes_per_min} c=${m.clicks_per_min} s=${m.scrolls_per_min} text="${txt}"`)
      }
    } else {
      logToFile('[activity-monitor] Send failed:', res.status)
      if (res.status === 401) await authenticate()
    }
  } catch (err) {
    logToFile('[activity-monitor] Send error:', err)
  }
}

// ── Windows C# Input Monitor ────────────────────────────────
// Uses SetWindowsHookEx for WH_KEYBOARD_LL and WH_MOUSE_LL
// Outputs "keystrokes|clicks|scrolls" to stdout every 5 seconds

const WIN_INPUT_CS = `
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

class InputMonitor {
    [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int idHook, LowLevelProc lpfn, IntPtr hMod, uint dwThreadId);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hhk);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string lpModuleName);
    [DllImport("user32.dll")] static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);
    [DllImport("user32.dll")] static extern bool TranslateMessage(ref MSG lpMsg);
    [DllImport("user32.dll")] static extern IntPtr DispatchMessage(ref MSG lpMsg);
    [DllImport("user32.dll")] static extern int ToUnicode(uint wVirtKey, uint wScanCode, byte[] lpKeyState, [Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pwszBuff, int cchBuff, uint wFlags);
    [DllImport("user32.dll")] static extern bool GetKeyboardState(byte[] lpKeyState);
    [DllImport("user32.dll")] static extern uint MapVirtualKey(uint uCode, uint uMapType);

    delegate IntPtr LowLevelProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    struct KBDLLHOOKSTRUCT { public uint vkCode; public uint scanCode; public uint flags; public uint time; public IntPtr dwExtraInfo; }

    [StructLayout(LayoutKind.Sequential)]
    struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam; public IntPtr lParam; public uint time; public int ptX; public int ptY; }

    const int WH_KEYBOARD_LL = 13;
    const int WH_MOUSE_LL = 14;
    const int WM_KEYDOWN = 0x0100;
    const int WM_LBUTTONDOWN = 0x0201;
    const int WM_RBUTTONDOWN = 0x0204;
    const int WM_MBUTTONDOWN = 0x0207;
    const int WM_MOUSEWHEEL = 0x020A;

    static int keystrokes = 0;
    static int clicks = 0;
    static int scrolls = 0;
    static List<string> keyBuffer = new List<string>();
    static object keyLock = new object();
    static LowLevelProc kbProc;
    static LowLevelProc mouseProc;
    static IntPtr kbHook = IntPtr.Zero;
    static IntPtr mouseHook = IntPtr.Zero;

    static string VkToString(uint vk, uint sc) {
        // Named keys
        switch (vk) {
            case 0x08: return "Backspace";
            case 0x09: return "Tab";
            case 0x0D: return "Enter";
            case 0x10: case 0xA0: case 0xA1: return "Shift";
            case 0x11: case 0xA2: case 0xA3: return "Ctrl";
            case 0x12: case 0xA4: case 0xA5: return "Alt";
            case 0x14: return "CapsLock";
            case 0x1B: return "Esc";
            case 0x20: return "Space";
            case 0x25: return "Left";
            case 0x26: return "Up";
            case 0x27: return "Right";
            case 0x28: return "Down";
            case 0x2E: return "Delete";
            case 0x5B: case 0x5C: return "Win";
            case 0x70: return "F1"; case 0x71: return "F2"; case 0x72: return "F3";
            case 0x73: return "F4"; case 0x74: return "F5"; case 0x75: return "F6";
            case 0x76: return "F7"; case 0x77: return "F8"; case 0x78: return "F9";
            case 0x79: return "F10"; case 0x7A: return "F11"; case 0x7B: return "F12";
        }
        // Try to get the actual character using ToUnicode
        byte[] keyState = new byte[256];
        GetKeyboardState(keyState);
        StringBuilder sb = new StringBuilder(4);
        int result = ToUnicode(vk, sc, keyState, sb, sb.Capacity, 0);
        if (result == 1 && sb.Length > 0) return sb.ToString();
        // Fallback: printable ASCII range
        if (vk >= 0x30 && vk <= 0x39) return ((char)vk).ToString();
        if (vk >= 0x41 && vk <= 0x5A) return ((char)(vk + 32)).ToString();
        return "key" + vk;
    }

    static IntPtr KbCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0 && (int)wParam == WM_KEYDOWN) {
            Interlocked.Increment(ref keystrokes);
            KBDLLHOOKSTRUCT kb = Marshal.PtrToStructure<KBDLLHOOKSTRUCT>(lParam);
            string keyName = VkToString(kb.vkCode, kb.scanCode);
            lock (keyLock) { keyBuffer.Add(keyName); }
        }
        return CallNextHookEx(kbHook, nCode, wParam, lParam);
    }

    static IntPtr MouseCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0) {
            int msg = (int)wParam;
            if (msg == WM_LBUTTONDOWN || msg == WM_RBUTTONDOWN || msg == WM_MBUTTONDOWN)
                Interlocked.Increment(ref clicks);
            else if (msg == WM_MOUSEWHEEL)
                Interlocked.Increment(ref scrolls);
        }
        return CallNextHookEx(mouseHook, nCode, wParam, lParam);
    }

    static void Main() {
        kbProc = new LowLevelProc(KbCallback);
        mouseProc = new LowLevelProc(MouseCallback);

        IntPtr hMod = GetModuleHandle(null);
        kbHook = SetWindowsHookEx(WH_KEYBOARD_LL, kbProc, hMod, 0);
        mouseHook = SetWindowsHookEx(WH_MOUSE_LL, mouseProc, hMod, 0);

        if (kbHook == IntPtr.Zero || mouseHook == IntPtr.Zero) {
            Console.Error.WriteLine("Failed to install hooks");
            return;
        }

        Console.Error.WriteLine("Hooks installed, monitoring input...");

        // Timer: output counts + keys every 5 seconds
        // Format: keystrokes|clicks|scrolls|key1,key2,key3,...
        var timer = new System.Threading.Timer(_ => {
            int k = Interlocked.Exchange(ref keystrokes, 0);
            int c = Interlocked.Exchange(ref clicks, 0);
            int s = Interlocked.Exchange(ref scrolls, 0);
            List<string> keys;
            lock (keyLock) { keys = new List<string>(keyBuffer); keyBuffer.Clear(); }
            string keysStr = keys.Count > 0 ? string.Join(",", keys) : "";
            Console.WriteLine(k + "|" + c + "|" + s + "|" + keysStr);
            Console.Out.Flush();
        }, null, 5000, 5000);

        // Message loop required for low-level hooks
        MSG msg;
        while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) {
            TranslateMessage(ref msg);
            DispatchMessage(ref msg);
        }

        UnhookWindowsHookEx(kbHook);
        UnhookWindowsHookEx(mouseHook);
        timer.Dispose();
    }
}
`

let winInputExePath: string | null = null
const INPUT_MONITOR_VERSION = '2' // bump to force recompile

async function ensureWinInputHelper(): Promise<string> {
  const userDataPath = app.getPath('userData')
  const exePath = join(userDataPath, 'input-monitor.exe')
  const csPath = join(userDataPath, 'input-monitor.cs')
  const versionPath = join(userDataPath, 'input-monitor.version')

  // Check version — recompile if outdated
  const currentVersion = existsSync(versionPath) ? fs.readFileSync(versionPath, 'utf-8').trim() : ''
  if (existsSync(exePath) && currentVersion === INPUT_MONITOR_VERSION) return exePath

  // Delete old exe to force recompile
  if (existsSync(exePath)) {
    try { fs.unlinkSync(exePath) } catch { /* ignore */ }
  }

  writeFileSync(csPath, WIN_INPUT_CS, 'utf-8')

  const cscPaths = [
    'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe'
  ]

  let cscPath = ''
  for (const p of cscPaths) {
    if (existsSync(p)) { cscPath = p; break }
  }

  if (!cscPath) throw new Error('csc.exe not found')

  await execFileAsync(cscPath, ['/nologo', '/optimize', `/out:${exePath}`, csPath], {
    windowsHide: true,
    timeout: 30000
  })

  fs.writeFileSync(versionPath, INPUT_MONITOR_VERSION, 'utf-8')
  logToFile('[activity-monitor] Compiled input-monitor.exe v' + INPUT_MONITOR_VERSION)
  return exePath
}

function startWindowsInputMonitor(): void {
  ensureWinInputHelper().then((exePath) => {
    winInputExePath = exePath
    const proc = execFile(exePath, [], { windowsHide: true })
    winInputProcess = proc

    logToFile('[activity-monitor] Windows input monitor started (PID:', proc.pid, ')')

    let lineBuffer = ''
    proc.stdout?.on('data', (chunk: Buffer) => {
      lineBuffer += chunk.toString()
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const parts = trimmed.split('|')
        if (parts.length < 3) continue

        const k = parseInt(parts[0], 10) || 0
        const c = parseInt(parts[1], 10) || 0
        const s = parseInt(parts[2], 10) || 0
        const keyNames = parts[3] ? parts[3].split(',').filter(Boolean) : []

        if (k === 0 && c === 0 && s === 0) continue

        const appName = getCurrentApp()
        ensureApp(appName)
        appData[appName].keystrokes += k
        appData[appName].clicks += c
        appData[appName].scrolls += s
        if (keyNames.length > 0) {
          appData[appName].typedKeys.push(...keyNames)
        }

        logToFile(`[activity-monitor] Win input: ${appName} k=${k} c=${c} s=${s} keys=${keyNames.length}`)
      }
    })

    proc.stderr?.on('data', (chunk: Buffer) => {
      logToFile('[activity-monitor] Win input stderr:', chunk.toString().trim())
    })

    proc.on('exit', (code) => {
      logToFile('[activity-monitor] Win input monitor exited with code', code)
      winInputProcess = null
      // Restart after 10 seconds if still running
      if (started) {
        setTimeout(() => {
          if (started) startWindowsInputMonitor()
        }, 10000)
      }
    })
  }).catch((err) => {
    logToFile('[activity-monitor] Failed to start Windows input monitor:', err?.message || err)
  })
}

// ── Public API ───────────────────────────────────────────────

export function startActivityMonitor(): void {
  if (started) return

  if (process.platform === 'darwin') {
    const trusted = systemPreferences.isTrustedAccessibilityClient(false)
    if (!trusted) {
      logToFile('[activity-monitor] Accessibility not granted — disabled')
      return
    }
  }

  supabaseUrl = getSetting('supabase_url') || ''
  supabaseKey = getSetting('supabase_anon_key') || ''

  if (!supabaseUrl || !supabaseKey) {
    logToFile('[activity-monitor] Supabase not configured — disabled')
    return
  }

  if (process.platform === 'win32') {
    // Windows: use native C# input monitor with SetWindowsHookEx
    logToFile('[activity-monitor] Starting Windows native input monitor')
    started = true
    startWindowsInputMonitor()
    authenticate().then((ok) => {
      logToFile('[activity-monitor] Auth result:', ok)
      flushIntervalId = setInterval(flush, FLUSH_INTERVAL_MS)
      logToFile('[activity-monitor] Running — tracking keystrokes, clicks, scrolls per app (Windows)')
    })
  } else {
    // macOS: use uiohook-napi in the main process
    try {
      const { uIOhook } = require('uiohook-napi')
      uiohookInstance = uIOhook

      uIOhook.on('keydown', (e: any) => {
        const appName = getCurrentApp()
        ensureApp(appName)
        appData[appName].keystrokes++
        const keyName = KEY_MAP[e.keycode] || `key${e.keycode}`
        appData[appName].typedKeys.push(keyName)
      })

      uIOhook.on('click', (e: any) => {
        const appName = getCurrentApp()
        ensureApp(appName)
        appData[appName].clicks++
        appData[appName].clickPositions.push({ x: e.x, y: e.y, button: e.button || 1 })
      })

      uIOhook.on('wheel', () => {
        const appName = getCurrentApp()
        ensureApp(appName)
        appData[appName].scrolls++
      })

      uIOhook.start()
      logToFile('[activity-monitor] uiohook started in main process')

      started = true

      authenticate().then((ok) => {
        logToFile('[activity-monitor] Auth result:', ok)
        flushIntervalId = setInterval(flush, FLUSH_INTERVAL_MS)
        logToFile('[activity-monitor] Running — tracking keystrokes, clicks, scrolls per app (macOS)')
      })
    } catch (err: any) {
      logToFile('[activity-monitor] Failed to start uiohook:', err?.message || err)
    }
  }
}

export function stopActivityMonitor(): void {
  if (!started) return

  flush()
  if (flushIntervalId) {
    clearInterval(flushIntervalId)
    flushIntervalId = null
  }

  // Stop platform-specific monitor
  if (process.platform === 'win32') {
    if (winInputProcess) {
      try { winInputProcess.kill() } catch { /* ignore */ }
      winInputProcess = null
    }
  } else {
    try { uiohookInstance?.stop() } catch { /* ignore */ }
  }

  started = false
  logToFile('[activity-monitor] Stopped')
}
