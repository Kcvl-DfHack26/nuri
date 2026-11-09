import type { NotificationResponse } from 'expo-notifications';

import { pushDataSchema } from '@starter/shared';
import { router, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { authClient } from '@/lib/api';
import { loadNotifications, pushAvailable } from '@/lib/notifications';
import { usePushRegistration } from '@/lib/push';

export function PushNotifications() {
  const { data: session, isPending } = authClient.useSession();
  const sessionId = session?.session.id;
  const userId = session?.user.id;
  const navigationKey = useRootNavigationState()?.key;
  const { refetch } = usePushRegistration(sessionId);

  useEffect(() => {
    if (!pushAvailable || !sessionId) {
      return;
    }
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refetch();
      }
    });
    return () => {
      listener.remove();
    };
  }, [refetch, sessionId]);

  useEffect(() => {
    if (!pushAvailable || isPending || !navigationKey) {
      return;
    }
    let active = true;
    let listener: { remove: () => void } | undefined;
    void loadNotifications()
      .then((notifications) => {
        if (!active) {
          return;
        }
        const open = (response: NotificationResponse) => {
          if (!active) {
            return;
          }
          notifications.clearLastNotificationResponse();
          const parsed = pushDataSchema.safeParse(response.notification.request.content.data);
          if (
            response.actionIdentifier !== notifications.DEFAULT_ACTION_IDENTIFIER ||
            !parsed.success ||
            parsed.data.recipientId !== userId
          ) {
            return;
          }
          const data = parsed.data;
          if ((data.kind === 'recipe-liked' || data.kind === 'recipe-ready') && data.recipeId) {
            router.navigate({ pathname: '/recipes/[id]', params: { id: data.recipeId } });
          } else {
            router.navigate('/import');
          }
        };
        listener = notifications.addNotificationResponseReceivedListener(open);
        const latest = notifications.getLastNotificationResponse();
        if (latest) {
          open(latest);
        }
      })
      .catch(() => {
        console.warn('通知の操作を監視できませんでした');
      });
    return () => {
      active = false;
      listener?.remove();
    };
  }, [isPending, navigationKey, userId]);
  return null;
}
