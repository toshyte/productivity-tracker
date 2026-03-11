import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native'
import { startTracking, stopTracking, isTracking } from '../services/UsageTracker'
import { getTodayStats } from '../services/database'

interface AppStat {
  app_name: string
  total_seconds: number
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function HomeScreen() {
  const [tracking, setTracking] = useState(isTracking())
  const [stats, setStats] = useState<AppStat[]>([])

  const refreshStats = useCallback(async () => {
    const data = await getTodayStats()
    setStats(data)
  }, [])

  useEffect(() => {
    refreshStats()
    const interval = setInterval(refreshStats, 10_000)
    return () => clearInterval(interval)
  }, [refreshStats])

  const handleToggle = async () => {
    if (tracking) {
      stopTracking()
      setTracking(false)
    } else {
      await startTracking()
      setTracking(isTracking())
    }
  }

  const totalSeconds = stats.reduce((s, a) => s + a.total_seconds, 0)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Today's Activity</Text>
        <Text style={styles.total}>{formatDuration(totalSeconds)}</Text>
      </View>

      <TouchableOpacity
        style={[styles.button, tracking ? styles.stopButton : styles.startButton]}
        onPress={handleToggle}
      >
        <Text style={styles.buttonText}>
          {tracking ? 'Stop Tracking' : 'Start Tracking'}
        </Text>
      </TouchableOpacity>

      <FlatList
        data={stats}
        keyExtractor={(item) => item.app_name}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.appName} numberOfLines={1}>
              {item.app_name.split('.').pop() || item.app_name}
            </Text>
            <Text style={styles.duration}>{formatDuration(item.total_seconds)}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No activity tracked yet today</Text>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1117', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { color: '#e4e6eb', fontSize: 22, fontWeight: '700' },
  total: { color: '#6366f1', fontSize: 20, fontWeight: '600' },
  button: { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  startButton: { backgroundColor: '#22c55e' },
  stopButton: { backgroundColor: '#ef4444' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#1a1d27',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2d3a'
  },
  appName: { color: '#e4e6eb', fontSize: 15, flex: 1, marginRight: 12 },
  duration: { color: '#8b8fa3', fontSize: 14, fontWeight: '500' },
  empty: { color: '#8b8fa3', textAlign: 'center', marginTop: 40, fontSize: 15 }
})
