import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { Feedback } from '@/components/feedback';
import { authClient } from '@/lib/api';

export function AuthCallback() {
  const { token, state, error } = useLocalSearchParams<{
    token?: string;
    state?: string;
    error?: string;
  }>();
  const [failure, setFailure] = useState<string | null>(null);
  const client = useQueryClient();
  useEffect(() => {
    let active = true;
    async function finish() {
      if (error) {
        throw new Error('リンクが無効か、有効期限が切れています。もう一度ログインしてください。');
      }
      if (token && Platform.OS !== 'web') {
        const expected = await SecureStore.getItemAsync('magic-link-state');
        if (!state || state !== expected) {
          throw new Error('メールを送信した端末でリンクを開いてください。');
        }
        const result = await authClient.$fetch('/mobile-magic-link', {
          method: 'POST',
          body: { token },
        });
        if (result.error) {
          throw new Error('リンクが無効か、有効期限が切れています。');
        }
        await SecureStore.deleteItemAsync('magic-link-state');
      }
      const session = await authClient.getSession();
      if (!session.data) {
        throw new Error('ログインを確認できませんでした。もう一度お試しください。');
      }
      if (active) {
        client.clear();
        router.replace('/timeline');
      }
    }
    void finish().catch((cause: unknown) => {
      if (active) {
        setFailure(cause instanceof Error ? cause.message : 'ログインできませんでした。');
      }
    });
    return () => {
      active = false;
    };
  }, [client, token, state, error]);
  return failure ? (
    <Feedback
      message={failure}
      onRetry={() => {
        router.replace('/account');
      }}
    />
  ) : (
    <Feedback fullScreen loading message="ログインを確認しています" />
  );
}
