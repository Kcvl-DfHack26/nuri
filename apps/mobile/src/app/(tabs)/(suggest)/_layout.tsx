import { Stack } from 'expo-router/stack';

import { stackOptions } from '@/theme/navigation';
export default function Layout() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="suggest" options={{ title: '提案', headerLargeTitleEnabled: true }} />
    </Stack>
  );
}
