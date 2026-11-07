import { Stack } from 'expo-router/stack';

import { stackOptions } from '@/theme/navigation';
export default function Layout() {
  return (
    <Stack screenOptions={stackOptions}>
      {/* Plan A ⑰ draws its own profile header. */}
      <Stack.Screen name="profile" options={{ title: 'マイ', headerShown: false }} />
    </Stack>
  );
}
