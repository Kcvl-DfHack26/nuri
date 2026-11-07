import { Stack } from 'expo-router/stack';

import { stackOptions } from '@/theme/navigation';

// The post tab opens ⑫-1. The SNS sample timeline stays in this stack at /timeline.
export const unstable_settings = { initialRouteName: 'record' };

export default function Layout() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="record" options={{ headerShown: false }} />
      <Stack.Screen name="timeline" options={{ title: '投稿' }} />
    </Stack>
  );
}
