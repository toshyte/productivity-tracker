import React, { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { configureAndLogin, isConfigured } from '../services/cloud-sync'
import UsageStats from '../native/UsageStats'

export default function SettingsScreen() {
  const [url, setUrl] = useState('')
  const [anonKey, setAnonKey] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [connected, setConnected] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
    checkPermission()
  }, [])

  async function loadSettings() {
    const savedUrl = await AsyncStorage.getItem('supabase_url')
    const savedKey = await AsyncStorage.getItem('supabase_anon_key')
    const savedEmail = await AsyncStorage.getItem('supabase_email')
    if (savedUrl) setUrl(savedUrl)
    if (savedKey) setAnonKey(savedKey)
    if (savedEmail) setEmail(savedEmail)
    setConnected(isConfigured())
  }

  async function checkPermission() {
    const perm = await UsageStats.hasPermission()
    setHasPermission(perm)
  }

  async function handleSave() {
    if (!url || !anonKey || !email || !password) {
      Alert.alert('Error', 'All fields are required')
      return
    }
    setSaving(true)
    const ok = await configureAndLogin(url, anonKey, email, password)
    setSaving(false)
    if (ok) {
      setConnected(true)
      Alert.alert('Success', 'Connected to Supabase')
    } else {
      Alert.alert('Error', 'Failed to connect. Check your credentials.')
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Usage Access Permission</Text>
      <View style={styles.card}>
        <Text style={styles.label}>
          Status: {hasPermission ? 'Granted' : 'Not Granted'}
        </Text>
        {!hasPermission && (
          <TouchableOpacity
            style={styles.permButton}
            onPress={() => {
              UsageStats.requestPermission()
              setTimeout(checkPermission, 2000)
            }}
          >
            <Text style={styles.permButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionTitle}>Cloud Sync (Supabase)</Text>
      <View style={styles.card}>
        <Text style={[styles.status, connected ? styles.statusOk : styles.statusOff]}>
          {connected ? 'Connected' : 'Not Connected'}
        </Text>

        <Text style={styles.label}>Supabase URL</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://your-project.supabase.co"
          placeholderTextColor="#555"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Anon Key</Text>
        <TextInput
          style={styles.input}
          value={anonKey}
          onChangeText={setAnonKey}
          placeholder="your-anon-key"
          placeholderTextColor="#555"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#555"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="password"
          placeholderTextColor="#555"
          secureTextEntry
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Connecting...' : 'Save & Connect'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1117', padding: 20 },
  sectionTitle: { color: '#e4e6eb', fontSize: 18, fontWeight: '700', marginBottom: 12, marginTop: 8 },
  card: {
    backgroundColor: '#1a1d27',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2d3a',
    marginBottom: 20
  },
  label: { color: '#8b8fa3', fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#0f1117',
    borderWidth: 1,
    borderColor: '#2a2d3a',
    borderRadius: 8,
    padding: 12,
    color: '#e4e6eb',
    fontSize: 14
  },
  status: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  statusOk: { color: '#22c55e' },
  statusOff: { color: '#ef4444' },
  saveButton: { backgroundColor: '#6366f1', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  permButton: { backgroundColor: '#f97316', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  permButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' }
})
