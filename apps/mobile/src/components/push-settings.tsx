import { Button, Host } from '@expo/ui';
import { useMutation } from '@tanstack/react-query';
import { Linking, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { pushAvailable } from '@/lib/notifications';
import { requestPushPermission, usePushRegistration } from '@/lib/push';

export function PushSettings({ sessionId }: { sessionId: string }) {
  const registration = usePushRegistration(sessionId);
  const registered = registration.data === 'registered';
  const systemSettings = registered || registration.data === 'blocked';
  const action = useMutation({
    mutationFn: async () => {
      if (systemSettings) {
        await Linking.openSettings();
        return;
      }
      await requestPushPermission();
      await registration.refetch();
    },
  });

  if (!pushAvailable) {
    return null;
  }

  return (
    <View className="gap-2 py-2 pl-3.5 pr-3">
      <Text className="font-maru-bold text-label text-ink-primary">プッシュ通知</Text>
      <Text className="font-maru text-meta text-ink-secondary">
        {registered
          ? 'この端末で通知を受け取れます。'
          : 'レシピへのいいねや動画レシピ作成のお知らせを受け取れます。'}
      </Text>
      {registration.error || action.isError ? (
        <Text accessibilityLiveRegion="polite" className="font-maru text-meta text-accent-rose">
          通知を設定できませんでした。時間をおいてもう一度お試しください。
        </Text>
      ) : null}
      <Host matchContents={{ vertical: true }} style={{ minHeight: 48 }}>
        <Button
          label={systemSettings ? '端末の通知設定を開く' : '通知を有効にする'}
          disabled={registration.isFetching || action.isPending}
          variant="outlined"
          onPress={() => {
            action.mutate();
          }}
        />
      </Host>
    </View>
  );
}
