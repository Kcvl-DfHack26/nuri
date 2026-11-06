import { Stack } from 'expo-router/stack';

import { PostDraftProvider } from '@/components/post-draft';

// ⑫-2〜⑫-9 share one device-only draft; leaving the flow discards it.
export default function PostLayout() {
  return (
    <PostDraftProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="recording" options={{ gestureEnabled: false }} />
        <Stack.Screen name="creating" options={{ gestureEnabled: false }} />
        <Stack.Screen
          name="cosmetics/[index]"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 28,
          }}
        />
      </Stack>
    </PostDraftProvider>
  );
}
