import type { ReactNode } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleButton } from '@/components/apple-button';
import { GoogleButton } from '@/components/google-button';
import { Text } from '@/components/ui/text';
import { api, apiUrl, authClient } from '@/lib/api';
import { backOrHome } from '@/lib/navigation';
import { passkeysAvailable, signInWithPasskey } from '@/lib/passkeys';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

import faceMadeUp from '../../assets/plan-a/photos/face-made-up.jpg';
import recipeCat from '../../assets/plan-a/recipes/cat.jpg';
import recipeFox from '../../assets/plan-a/recipes/fox.jpg';
import sparkleGold from '../../assets/plan-a/start/sparkle-gold.svg';
import sparklePink from '../../assets/plan-a/start/sparkle-pink.svg';
import sparkleRose from '../../assets/plan-a/start/sparkle-rose.svg';

const SHADOW = '0px 8px 10px rgba(196, 61, 112, 0.25)';
const PHOTO_SHADOW = '0px 10px 24px rgba(196, 61, 112, 0.18)';

function useCapabilities() {
  return useQuery({
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
}

// Plan A ⑱ ログイン. The sign-in flows are the Better Auth ones; only the presentation follows Plan A.
export function Account() {
  const session = authClient.useSession();
  const insets = useSafeAreaInsets();
  const rose = useTokenColor('--color-accent-rose');
  const capabilities = useCapabilities();

  let actions: ReactNode;
  if (!apiUrl) {
    actions = <Notice>接続先が未設定です。セットアップ後にログインできます。</Notice>;
  } else if (session.isPending || capabilities.isPending) {
    actions = (
      <View className="items-center gap-2 py-2">
        <ActivityIndicator color={rose} accessibilityLabel="読み込み中" />
        <Notice>ログインの準備をしています</Notice>
      </View>
    );
  } else if (capabilities.isError || session.error) {
    actions = (
      <>
        <Notice alert>
          {capabilities.isError ? capabilities.error.message : 'アカウントを確認できませんでした。'}
        </Notice>
        <PillButton
          tone="outline"
          label="もう一度試す"
          onPress={() => {
            void (capabilities.isError ? capabilities.refetch() : session.refetch());
          }}
        />
      </>
    );
  } else if (session.data) {
    actions = (
      <PillButton
        tone="rose"
        label="もとの画面に戻る"
        onPress={() => {
          // Return to the screen that asked for login (#42).
          backOrHome();
        }}
      />
    );
  } else {
    actions = <SignInOptions capabilities={capabilities.data} />;
  }

  return (
    <View
      className="flex-1 bg-white"
      style={{
        backgroundImage: 'linear-gradient(to bottom, #fff0f5 0%, #ffffff 55%, #ffffff 100%)',
      }}
    >
      <StatusBar style="dark" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
        }}
      >
        <Collage />
        <View className="mt-5.5 items-center gap-1.5">
          <Text
            accessibilityRole="header"
            className="text-center font-maru-black text-login-wordmark text-accent-rose"
          >
            nuri
          </Text>
          <Text className="text-center font-maru-bold text-heading text-ink-primary">
            あの子のメイクをわたしの顔で
          </Text>
        </View>
        <View className="mt-6.75 gap-2.5">
          {actions}
          {session.data ? null : (
            // Plan A draws this link in light blue; ink-secondary keeps it readable (WCAG AA) on white.
            <LinkButton label="ゲストで参加" className="text-ink-secondary" onPress={backOrHome} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SignInOptions({
  capabilities,
}: {
  capabilities: NonNullable<ReturnType<typeof useCapabilities>['data']>;
}) {
  const client = useQueryClient();
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
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
        provider: capabilities.emulated ? `emulate-${method}` : method,
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
        // Return to the screen that asked for login.
        backOrHome();
      }
    },
  });
  const canSend = !login.isPending && email.trim().includes('@');
  const sendLink = () => {
    if (canSend) {
      login.mutate('email');
    }
  };
  return (
    <>
      {capabilities.apple ? (
        <AppleButton
          disabled={login.isPending}
          onPress={() => {
            login.mutate('apple');
          }}
        />
      ) : null}
      {capabilities.google ? (
        <GoogleButton
          disabled={login.isPending}
          onPress={() => {
            login.mutate('google');
          }}
        />
      ) : null}
      {capabilities.email && emailOpen ? (
        <>
          <EmailInput
            value={email}
            editable={!login.isPending}
            onChange={(value) => {
              setEmail(value);
              setSent(false);
            }}
            onSubmit={sendLink}
          />
          <PillButton
            tone="rose"
            label={login.isPending ? '処理中' : 'ログインリンクを送信'}
            disabled={!canSend}
            onPress={sendLink}
          />
        </>
      ) : null}
      {capabilities.email && !emailOpen ? (
        <PillButton
          tone="rose"
          label="メールアドレスで続ける"
          disabled={login.isPending}
          onPress={() => {
            setEmailOpen(true);
          }}
        />
      ) : null}
      {sent ? (
        <Notice live>メールを送信しました。10分以内に、この端末でリンクを開いてください。</Notice>
      ) : null}
      {login.error ? <Notice alert>{login.error.message}</Notice> : null}
      {passkeysAvailable ? (
        <LinkButton
          label="パスキーでログイン"
          className="text-accent-rose"
          disabled={login.isPending}
          onPress={() => {
            login.mutate('passkey');
          }}
        />
      ) : null}
      {capabilities.emulated ? (
        <Notice>サンプル環境ではテスト用アカウントとメール受信箱を使用します</Notice>
      ) : null}
    </>
  );
}

// Three tilted sample photos with sparkles, positioned on Plan A's 390pt-wide canvas.
function Collage() {
  return (
    <View className="h-75 w-97.5 self-center">
      <CollagePhoto
        source={recipeFox}
        left={33.84}
        top={47.39}
        width={140}
        height={180}
        tilt={-8}
      />
      <CollagePhoto
        source={recipeCat}
        left={222.79}
        top={46.87}
        width={140}
        height={180}
        tilt={8}
      />
      <CollagePhoto source={faceMadeUp} left={115} top={20} width={160} height={214} tilt={0} />
      <Sparkle source={sparkleRose} left={40} top={40} size={20} />
      <Sparkle source={sparkleGold} left={340} top={250} size={22} />
      <Sparkle source={sparklePink} left={70} top={280} size={14} />
      <Sparkle source={sparklePink} left={300} top={20} size={14} />
    </View>
  );
}

function CollagePhoto({
  source,
  left,
  top,
  width,
  height,
  tilt,
}: {
  source: number;
  left: number;
  top: number;
  width: number;
  height: number;
  tilt: number;
}) {
  return (
    <View
      className="absolute rounded-control-compact bg-white p-1.25"
      style={{
        left,
        top,
        width,
        height,
        boxShadow: PHOTO_SHADOW,
        transform: [{ rotate: `${tilt}deg` }],
      }}
    >
      <Image
        accessible={false}
        source={source}
        contentFit="cover"
        style={{ flex: 1, borderRadius: 17 }}
      />
    </View>
  );
}

function Sparkle({
  source,
  left,
  top,
  size,
}: {
  source: number;
  left: number;
  top: number;
  size: number;
}) {
  return (
    <Image
      accessible={false}
      source={source}
      style={{ position: 'absolute', left, top, width: size, height: size }}
    />
  );
}

function PillButton({
  label,
  tone,
  disabled = false,
  onPress,
}: {
  label: string;
  tone: 'rose' | 'outline';
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'min-h-13 items-center justify-center rounded-full px-4.5 py-2 active:opacity-80',
        tone === 'rose' ? 'bg-accent-rose' : 'border-fine border-black/15 bg-white',
        disabled && 'opacity-50',
      )}
      style={tone === 'rose' ? { boxShadow: SHADOW } : undefined}
    >
      <Text
        className={cn(
          'text-center font-maru-bold text-action',
          tone === 'rose' ? 'text-white' : 'text-ink-primary',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function LinkButton({
  label,
  className,
  disabled = false,
  onPress,
}: {
  label: string;
  className: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'min-h-12 items-center justify-center self-center px-4 active:opacity-60',
        disabled && 'opacity-50',
      )}
    >
      <Text className={cn('text-center font-maru-bold text-label', className)}>{label}</Text>
    </Pressable>
  );
}

function EmailInput({
  value,
  editable,
  onChange,
  onSubmit,
}: {
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const placeholder = useTokenColor('--color-ink-secondary');
  return (
    <TextInput
      accessibilityLabel="メールアドレス"
      placeholder="メールアドレス"
      placeholderTextColor={placeholder}
      keyboardType="email-address"
      autoComplete="email"
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="send"
      value={value}
      editable={editable}
      onChangeText={onChange}
      onSubmitEditing={onSubmit}
      className="min-h-13 rounded-full border-fine border-line-soft bg-white px-4.5 py-3 font-maru text-action text-ink-primary"
    />
  );
}

function Notice({
  children,
  alert = false,
  live = false,
}: {
  children: ReactNode;
  alert?: boolean;
  live?: boolean;
}) {
  return (
    <Text
      accessibilityRole={alert ? 'alert' : undefined}
      accessibilityLiveRegion={live || alert ? 'polite' : undefined}
      className={cn(
        'text-center font-maru text-label',
        alert ? 'text-accent-rose' : 'text-ink-secondary',
      )}
    >
      {children}
    </Text>
  );
}
