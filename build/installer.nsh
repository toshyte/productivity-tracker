!macro customInit
  ; Kill the running app BEFORE the installer checks for running instances
  nsExec::ExecToLog 'taskkill /F /IM "Productivity Tracker.exe"'
  nsExec::ExecToLog 'taskkill /F /IM "ProductivityTracker.exe"'
  nsExec::ExecToLog 'taskkill /F /IM "Productivity.Tracker.exe"'
  ; Also kill by window title in case process name varies
  nsExec::ExecToLog 'powershell -NoProfile -Command "Get-Process | Where-Object {$$_.MainWindowTitle -like ''*Productivity Tracker*''} | Stop-Process -Force -ErrorAction SilentlyContinue"'
  Sleep 3000
!macroend

!macro customUnInit
  ; Kill the running app BEFORE the uninstaller checks
  nsExec::ExecToLog 'taskkill /F /IM "Productivity Tracker.exe"'
  nsExec::ExecToLog 'taskkill /F /IM "ProductivityTracker.exe"'
  nsExec::ExecToLog 'taskkill /F /IM "Productivity.Tracker.exe"'
  nsExec::ExecToLog 'powershell -NoProfile -Command "Get-Process | Where-Object {$$_.MainWindowTitle -like ''*Productivity Tracker*''} | Stop-Process -Force -ErrorAction SilentlyContinue"'
  Sleep 3000
!macroend

!macro customUnInstall
  ; Clean up auto-start registry entry
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Productivity Tracker"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.productivity-tracker.app"
  ; Remove app data
  RMDir /r "$APPDATA\Productivity Tracker"
  RMDir /r "$LOCALAPPDATA\Productivity Tracker"
  RMDir /r "$LOCALAPPDATA\productivity-tracker"
  RMDir /r "$LOCALAPPDATA\com.productivity-tracker.app"
!macroend
