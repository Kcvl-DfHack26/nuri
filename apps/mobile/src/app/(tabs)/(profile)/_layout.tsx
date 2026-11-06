import { Stack } from 'expo-router/stack';

import { stackOptions } from '@/theme/navigation';
export default function Layout() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen
        name="profile"
        options={{ title: 'マイページ', headerLargeTitleEnabled: true }}
      />
    </Stack>
  );
}
