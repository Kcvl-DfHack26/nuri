import { Button, FieldGroup, Text } from '@expo/ui';
import { useMutation } from '@tanstack/react-query';
import { Linking } from 'react-native';

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
      await registration.refetch({ throwOnError: true });
    },
  });

  if (!pushAvailable) {
    return null;
  }

  return (
    <FieldGroup.Section title="プッシュ通知">
      <Text>
        {registered
          ? 'この端末で通知を受け取れます。'
          : '投稿へのいいねやレシピ作成のお知らせを受け取れます。'}
      </Text>
      {registration.error || action.isError ? (
        <Text>通知を設定できませんでした。時間をおいてもう一度お試しください。</Text>
      ) : null}
      <Button
        label={systemSettings ? '端末の通知設定を開く' : '通知を有効にする'}
        disabled={registration.isFetching || action.isPending}
        variant="outlined"
        onPress={() => {
          action.mutate();
        }}
      />
    </FieldGroup.Section>
  );
}
