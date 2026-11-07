import '../../global.css';

import { ZenMaruGothic_500Medium } from '@expo-google-fonts/zen-maru-gothic/500Medium';
import { ZenMaruGothic_700Bold } from '@expo-google-fonts/zen-maru-gothic/700Bold';
import { ZenMaruGothic_900Black } from '@expo-google-fonts/zen-maru-gothic/900Black';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useColorScheme } from 'react-native';

import { Launch } from '@/components/launch';
import { PreferencesProvider } from '@/lib/preferences';
import { stackOptions } from '@/theme/navigation';

function Navigation() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={stackOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="account" options={{ title: 'ログイン', headerShown: false }} />
        <Stack.Screen name="users/[id]" options={{ title: 'プロフィール' }} />
        <Stack.Screen name="settings" options={{ title: '設定' }} />
        <Stack.Screen name="post" options={{ headerShown: false }} />
        <Stack.Screen name="recipes/[id]/index" options={{ headerShown: false }} />
        <Stack.Screen name="recipes/[id]/steps" options={{ headerShown: false }} />
        <Stack.Screen name="recipes/[id]/finish" options={{ headerShown: false }} />
        <Stack.Screen name="parts/[part]" options={{ headerShown: false }} />
        <Stack.Screen
          name="products/[id]"
          options={{
            headerShown: false,
            presentation: 'formSheet',
            // Plan A ⑥ is about half the screen. ProductSheet sets its own height (taller for
            // large text) and the sheet follows it.
            sheetAllowedDetents: 'fitToContents',
            sheetGrabberVisible: true,
            sheetCornerRadius: 28,
          }}
        />
        {/* Plan A ④ draws its own sheet header; ④-4 covers the sheet so back returns to it. */}
        <Stack.Screen
          name="import/index"
          options={{
            headerShown: false,
            presentation: 'formSheet',
            sheetAllowedDetents: [0.65, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 28,
          }}
        />
        <Stack.Screen
          name="import/steps"
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
        <Stack.Screen name="recipes/[id]/compare" options={{ headerShown: false }} />
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
  // Plan A text uses Zen Maru Gothic; fall back to the system font if loading fails.
  const [fontsLoaded, fontError] = useFonts({
    ZenMaruGothic_500Medium,
    ZenMaruGothic_700Bold,
    ZenMaruGothic_900Black,
  });
  if (!fontsLoaded && !fontError) {
    return <Launch />;
  }
  return (
    <QueryClientProvider client={client}>
      <PreferencesProvider>
        <Navigation />
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
