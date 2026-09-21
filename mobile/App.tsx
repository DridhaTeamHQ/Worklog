import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ToastProvider } from './src/context/ToastContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { LogBox } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';

LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'Unsupported top level event type',
  'Cannot connect to Expo CLI',
]);

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <NotificationProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </NotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
