import '../../global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useColorScheme } from 'react-native';

import { PreferencesProvider } from '@/lib/preferences';
import { stackOptions } from '@/theme/navigation';

function Navigation() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={stackOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="account" options={{ title: 'ログイン' }} />
        <Stack.Screen name="users/[id]" options={{ title: 'プロフィール' }} />
        <Stack.Screen
          name="compose"
          options={{
            title: '投稿',
            presentation: 'formSheet',
            sheetAllowedDetents: [0.65, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen
          name="profile-edit"
          options={{
            title: 'プロフィール',
            presentation: 'formSheet',
            sheetAllowedDetents: [0.4, 0.75],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen name="auth-callback" options={{ title: 'ログイン' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <PreferencesProvider>
        <Navigation />
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
