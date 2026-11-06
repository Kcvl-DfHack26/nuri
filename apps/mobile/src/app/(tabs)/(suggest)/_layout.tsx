import { Stack } from 'expo-router/stack';

// Plan A ⑬⑭ draw their own headers over the photo and the result feed.
export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="suggest" options={{ title: '提案' }} />
      <Stack.Screen name="diagnosis" options={{ title: '診断結果' }} />
    </Stack>
  );
}
