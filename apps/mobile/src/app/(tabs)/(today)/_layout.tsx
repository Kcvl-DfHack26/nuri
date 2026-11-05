import { Stack } from 'expo-router/stack';

export default function TodayLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Today', headerLargeTitleEnabled: true }} />
    </Stack>
  );
}
