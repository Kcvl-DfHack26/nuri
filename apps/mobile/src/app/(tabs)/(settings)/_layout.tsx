import { Stack } from 'expo-router/stack';

import { stackOptions } from '@/theme/navigation';
export default function Layout() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="settings" options={{ title: '設定', headerLargeTitleEnabled: true }} />
    </Stack>
  );
}
