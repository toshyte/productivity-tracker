import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import HomeScreen from './src/screens/HomeScreen'
import SettingsScreen from './src/screens/SettingsScreen'
import { initDatabase } from './src/services/database'
import { initCloudSync } from './src/services/cloud-sync'

const Stack = createNativeStackNavigator()

export default function App() {
  useEffect(() => {
    async function init() {
      await initDatabase()
      await initCloudSync()
    }
    init()
  }, [])

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#0f1117' },
          headerTintColor: '#e4e6eb',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#0f1117' }
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={({ navigation }) => ({
            title: 'Productivity Tracker',
            headerRight: () => (
              <React.Fragment>
                <SettingsButton onPress={() => navigation.navigate('Settings')} />
              </React.Fragment>
            )
          })}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

function SettingsButton({ onPress }: { onPress: () => void }) {
  const { TouchableOpacity, Text } = require('react-native')
  return (
    <TouchableOpacity onPress={onPress} style={{ padding: 8 }}>
      <Text style={{ color: '#6366f1', fontSize: 15 }}>Settings</Text>
    </TouchableOpacity>
  )
}
