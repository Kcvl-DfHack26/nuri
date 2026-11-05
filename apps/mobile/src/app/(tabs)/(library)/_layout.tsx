import { Stack } from 'expo-router/stack';

export default function LibraryLayout() {
  return (
    <Stack>
      <Stack.Screen name="library" options={{ title: 'Library', headerLargeTitleEnabled: true }} />
    </Stack>
  );
}
