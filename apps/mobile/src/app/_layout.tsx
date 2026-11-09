import '../../global.css';

import { ZenMaruGothic_500Medium } from '@expo-google-fonts/zen-maru-gothic/500Medium';
import { ZenMaruGothic_700Bold } from '@expo-google-fonts/zen-maru-gothic/700Bold';
import { ZenMaruGothic_900Black } from '@expo-google-fonts/zen-maru-gothic/900Black';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Uniwind } from 'uniwind';

import { Launch } from '@/components/launch';
import { PushNotifications } from '@/components/push-notifications';
import { stackOptions } from '@/theme/navigation';

Uniwind.setTheme('light');

function Navigation() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack screenOptions={stackOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="account" options={{ title: 'ログイン', headerShown: false }} />
        <Stack.Screen name="users/[id]" options={{ title: 'プロフィール' }} />
        <Stack.Screen name="post" options={{ headerShown: false }} />
        <Stack.Screen name="recipes/[id]/index" options={{ headerShown: false }} />
        <Stack.Screen name="recipes/[id]/steps" options={{ headerShown: false }} />
        <Stack.Screen name="recipes/[id]/finish" options={{ headerShown: false }} />
        <Stack.Screen name="parts/[part]" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ headerShown: false }} />
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
        {/* Plan A ④ draws its own sheet header. */}
        <Stack.Screen
          name="import/index"
          options={{
            headerShown: false,
            presentation: 'formSheet',
            // SnsImport sets its own height and the sheet follows it, as ⑥ does.
            sheetAllowedDetents: 'fitToContents',
            sheetGrabberVisible: true,
            sheetCornerRadius: 28,
          }}
        />
        <Stack.Screen name="recipes/[id]/compare" options={{ headerShown: false }} />
        <Stack.Screen name="profile-settings" options={{ headerShown: false }} />
        <Stack.Screen name="auth-callback" options={{ title: 'ログイン' }} />
      </Stack>
      <PushNotifications />
      <StatusBar style="dark" />
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
      <Navigation />
    </QueryClientProvider>
  );
}
