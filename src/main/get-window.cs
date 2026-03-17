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
                                return false; // stop enumerating
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
