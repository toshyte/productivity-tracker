import { NativeModules } from 'react-native'

interface UsageStatsNative {
  hasPermission(): Promise<boolean>
  requestPermission(): void
  getForegroundApp(): Promise<{
    packageName: string
    lastTimeUsed: number
    totalTimeInForeground: number
  } | null>
}

const { UsageStats } = NativeModules as { UsageStats: UsageStatsNative }

export default UsageStats
