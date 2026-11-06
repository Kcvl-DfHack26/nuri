import { Button, Column, Icon, TextInput } from '@expo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { AppleButton } from '@/components/apple-button';
import { AuthButton } from '@/components/auth-button';
import { Feedback } from '@/components/feedback';
import { GoogleButton } from '@/components/google-button';
import { NativeHost } from '@/components/native-host';
import { Screen } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { api, apiUrl, authClient } from '@/lib/api';
import { passkeysAvailable, signInWithPasskey } from '@/lib/passkeys';
import { colors } from '@/theme/colors';

export function Account() {
  const session = authClient.useSession();
  const client = useQueryClient();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const capabilities = useQuery({
    queryKey: ['auth-capabilities'],
    enabled: Boolean(apiUrl),
    queryFn: async ({ signal }) => {
      const response = await api.api['auth-capabilities'].$get({}, { init: { signal } });
      if (!response.ok) {
        throw new Error('ログイン方法を読み込めませんでした。');
      }
      return await response.json();
    },
  });
  const login = useMutation({
    mutationFn: async (method: 'google' | 'apple' | 'passkey' | 'email') => {
      if (method === 'passkey') {
        await signInWithPasskey();
        return;
      }
      if (method === 'email') {
        const state = Crypto.randomUUID();
        if (Platform.OS !== 'web') {
          await SecureStore.setItemAsync('magic-link-state', state);
        }
        const callbackURL =
          Platform.OS === 'web'
            ? Linking.createURL('/auth-callback')
            : Linking.createURL('/auth-callback', { queryParams: { state } });
        const result = await authClient.signIn.magicLink({
          email: email.trim(),
          name: '新しいユーザー',
          callbackURL,
        });
        if (result.error) {
          throw new Error('メールを送信できませんでした。入力内容を確認してお試しください。');
        }
        setSent(true);
        return;
      }
      const result = await authClient.signIn.social({
        provider: capabilities.data?.emulated ? `emulate-${method}` : method,
        callbackURL: Linking.createURL('/'),
      });
      if (result.error) {
        throw new Error('ログインを完了できませんでした。もう一度お試しください。');
      }
    },
    onSuccess: async (_data, method) => {
      if (method === 'email') {
        return;
      }
      const current = await authClient.getSession();
      // Dismissing the OS login browser is cancellation, not a successful login.
      if (current.data) {
        client.clear();
        router.replace('/timeline');
      }
    },
  });
  if (!apiUrl) {
    return <Feedback fullScreen message="接続先が未設定です。セットアップ後にログインできます。" />;
  }
  if (session.isPending || capabilities.isPending) {
    return <Feedback fullScreen loading message="ログインの準備をしています" />;
  }
  if (capabilities.isError) {
    return (
      <Feedback
        fullScreen
        message={capabilities.error.message}
        onRetry={() => {
          void capabilities.refetch();
        }}
      />
    );
  }
  if (session.error) {
    return (
      <Feedback
        fullScreen
        message="アカウントを確認できませんでした。"
        onRetry={() => {
          void session.refetch();
        }}
      />
    );
  }
  return (
    <Screen>
      <Text className="text-muted-foreground">
        投稿やいいねを利用するにはログインしてください
        初めての方は同じ操作でアカウントを作成できます
      </Text>
      {session.data ? (
        <NativeHost matchContents={{ vertical: true }}>
          <Button
            label="タイムラインに戻る"
            onPress={() => {
              router.replace('/timeline');
            }}
          />
        </NativeHost>
      ) : (
        <View style={{ gap: 28 }}>
          <View style={{ gap: 12 }}>
            {capabilities.data?.apple ? (
              <AppleButton
                disabled={login.isPending}
                onPress={() => {
                  login.mutate('apple');
                }}
              />
            ) : null}
            {capabilities.data?.google ? (
              <GoogleButton
                disabled={login.isPending}
                onPress={() => {
                  login.mutate('google');
                }}
              />
            ) : null}
            <NativeHost matchContents={{ vertical: true }}>
              <AuthButton
                label="パスキーでログイン"
                icon={Icon.select({
                  ios: 'person.badge.key.fill',
                  android: import('@expo/material-symbols/passkey.xml'),
                })}
                disabled={login.isPending || !passkeysAvailable}
                onPress={() => {
                  login.mutate('passkey');
                }}
              />
            </NativeHost>
          </View>
          {capabilities.data?.email ? (
            <View style={{ gap: 12 }}>
              <Text className="font-semibold">メールでログイン</Text>
              <NativeHost matchContents={{ vertical: true }}>
                <Column spacing={16} style={{ width: '100%' }}>
                  <TextInput
                    accessibilityLabel="メールアドレス"
                    placeholder="メールアドレス"
                    keyboardType="email-address"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{
                      width: '100%',
                      padding: 16,
                      backgroundColor: colors.card,
                      borderRadius: 12,
                    }}
                    onChangeText={(value) => {
                      setEmail(value);
                      setSent(false);
                    }}
                    editable={!login.isPending}
                  />
                  <AuthButton
                    label={login.isPending ? '処理中' : 'ログインリンクを送信'}
                    icon={Icon.select({
                      ios: 'envelope',
                      android: import('@expo/material-symbols/mail.xml'),
                    })}
                    disabled={login.isPending || !email.trim().includes('@')}
                    onPress={() => {
                      login.mutate('email');
                    }}
                  />
                </Column>
              </NativeHost>
            </View>
          ) : null}
        </View>
      )}
      {sent ? (
        <Text accessibilityLiveRegion="polite">
          メールを送信しました。10分以内に、この端末でリンクを開いてください。
        </Text>
      ) : null}
      {!passkeysAvailable ? (
        <Text className="text-caption text-muted-foreground">
          この環境ではパスキーを利用できません。ほかの方法でログインしてください。
        </Text>
      ) : null}
      {login.error ? <Feedback message={login.error.message} /> : null}
      {capabilities.data?.emulated ? (
        <Text className="text-caption text-muted-foreground">
          サンプル環境ではテスト用アカウントとメール受信箱を使用します
        </Text>
      ) : null}
      <NativeHost matchContents={{ vertical: true }}>
        <Button
          label="タイムラインを見る"
          variant="outlined"
          onPress={() => {
            router.replace('/timeline');
          }}
        />
      </NativeHost>
    </Screen>
  );
}
