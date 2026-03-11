import { powerMonitor } from 'electron'

const IDLE_THRESHOLD_S = 300 // 5 minutes

export function getIdleSeconds(): number {
  return powerMonitor.getSystemIdleTime()
}

export function isIdle(): boolean {
  return getIdleSeconds() >= IDLE_THRESHOLD_S
}
