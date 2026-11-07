import { useGlobalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';

import { PostDraftProvider } from '@/components/post-draft';

// ⑫-2〜⑫-9 share one device-only draft; leaving the flow discards it.
export default function PostLayout() {
  // ⑫-1 opens the flow with the chosen video's URI when the post starts from 動画から.
  const { video } = useGlobalSearchParams<{ video?: string }>();
  return (
    <PostDraftProvider videoUri={video}>
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
