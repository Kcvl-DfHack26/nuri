import { pushChannels } from '@starter/shared';
import { useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';

import { api } from '@/lib/api';
import { loadNotifications, pushAvailable } from '@/lib/notifications';

async function ensureChannels(notifications: typeof import('expo-notifications')) {
  if (Platform.OS === 'android') {
    await Promise.all(
      Object.entries(pushChannels).map(([id, name]) =>
        notifications.setNotificationChannelAsync(id, {
          name,
          importance: notifications.AndroidImportance.DEFAULT,
        }),
      ),
    );
  }
}

export async function requestPushPermission() {
  const notifications = await loadNotifications();
  await ensureChannels(notifications);
  const permission = await notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    await notifications.requestPermissionsAsync();
  }
}

// The root and settings share one query so registration and errors are visible in both places.
export function usePushRegistration(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['push-subscription', sessionId],
    enabled: pushAvailable && Boolean(sessionId),
    queryFn: async ({ signal }) => {
      if (!sessionId) {
        throw new Error('通知を受け取るにはログインしてください。');
      }
      const notifications = await loadNotifications();
      const permission = await notifications.getPermissionsAsync();
      if (!permission.granted) {
        return permission.canAskAgain ? 'prompt' : 'blocked';
      }
      await ensureChannels(notifications);
      const { data: token } = await notifications.getExpoPushTokenAsync();
      const response = await api.api.me['push-subscription'].$put(
        { json: { token, sessionId } },
        { init: { signal } },
      );
      if (response.status === 503) {
        throw new Error('通知サービスは現在利用できません。');
      }
      if (!response.ok) {
        throw new Error('通知を登録できませんでした。');
      }
      return 'registered';
    },
  });
}
