import { Stack } from 'expo-router/stack';

import { stackOptions } from '@/theme/navigation';
export default function Layout() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="timeline" options={{ title: '投稿' }} />
    </Stack>
  );
}
