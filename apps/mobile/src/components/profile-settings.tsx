import type { ReactNode } from 'react';

import { Icon } from '@expo/ui';
import { profileInputSchema } from '@starter/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { GlassIconButton } from '@/components/glass-icon-button';
import { BottomCta, PrimaryButton } from '@/components/post-chrome';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { authClient } from '@/lib/api';
import { backOrHome } from '@/lib/navigation';
import { useTokenColor } from '@/theme/tokens';

import sampleAvatar from '../../assets/plan-a/my/avatar.png';

const BACK = Icon.select({
  ios: 'chevron.left',
  android: import('@expo/material-symbols/arrow_back_ios_new.xml'),
});
const CAMERA = Icon.select({
  ios: 'camera',
  android: import('@expo/material-symbols/photo_camera.xml'),
});
const NEXT = Icon.select({
  ios: 'chevron.right',
  android: import('@expo/material-symbols/chevron_right.xml'),
});

// Plan A ⑰-2 プロフィール設定. The display name saves through Better Auth like the old profile
// editor; the other profile fields, the face type and the switches are Plan A samples shown as
// not built yet. The app's own settings (appearance, haptics, passkeys) open from the bottom.
export function ProfileSettings() {
  const insets = useSafeAreaInsets();
  const session = authClient.useSession();
  // The header floats over the form; measure it so larger text never covers the first field.
  const [headerHeight, setHeaderHeight] = useState(44);
  const user = session.data?.user;
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      {session.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator accessibilityLabel="読み込み中" />
        </View>
      ) : user ? (
        <Editor
          key={user.id}
          name={user.name}
          email={user.email}
          image={user.image}
          top={insets.top + headerHeight + 16}
        />
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          contentContainerClassName="gap-5 px-4"
          contentContainerStyle={{
            paddingTop: insets.top + headerHeight + 16,
            paddingBottom: Math.max(insets.bottom, 12) + 24,
          }}
        >
          <Text className="font-maru text-ui text-ink-secondary">
            ログインするとプロフィールを変更できます
          </Text>
          <PrimaryButton
            label="ログイン"
            onPress={() => {
              router.push('/account');
            }}
          />
          <AppSection />
        </ScrollView>
      )}
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0"
        style={{
          height: insets.top + headerHeight + 20,
          backgroundImage:
            'linear-gradient(to bottom, #ffffff 0%, rgba(255,255,255,0.97) 82%, rgba(255,255,255,0) 100%)',
        }}
      />
      <View
        className="absolute inset-x-4 min-h-11 flex-row items-center gap-2"
        style={{ top: insets.top + 8 }}
        onLayout={(event) => {
          setHeaderHeight(event.nativeEvent.layout.height);
        }}
      >
        <GlassIconButton
          icon={BACK}
          label="戻る"
          className="border-black/8 bg-white"
          onPress={() => {
            backOrHome();
          }}
        />
        <Text
          accessibilityRole="header"
          className="flex-1 text-center font-maru-bold text-heading text-ink-primary"
        >
          プロフィール設定
        </Text>
        {/* Balances the back button so the title stays centered. */}
        <View className="size-10" />
      </View>
    </View>
  );
}

function Editor({
  name: initialName,
  email,
  image,
  top,
}: {
  name: string;
  email: string;
  image: string | null | undefined;
  top: number;
}) {
  const [name, setName] = useState(initialName);
  const client = useQueryClient();
  const secondary = useTokenColor('--color-ink-secondary');
  const save = useMutation({
    mutationFn: async () => {
      const result = await authClient.updateUser(profileInputSchema.parse({ name }));
      if (result.error) {
        throw new Error('変更を保存できませんでした。もう一度お試しください。');
      }
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['posts'] }),
        client.invalidateQueries({ queryKey: ['user'] }),
      ]);
      backOrHome();
    },
  });
  const logout = useMutation({
    mutationFn: async () => {
      const result = await authClient.signOut();
      if (result.error) {
        throw new Error('ログアウトできませんでした。もう一度お試しください。');
      }
    },
    onSuccess: () => {
      client.clear();
      router.dismissTo('/');
    },
  });
  const canSave =
    name !== initialName && profileInputSchema.safeParse({ name }).success && !save.isPending;
  const error = save.error ?? logout.error;
  return (
    <>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="gap-5 px-4"
        contentContainerStyle={{ paddingTop: top, paddingBottom: 24 }}
      >
        <View className="items-center gap-2">
          <View className="size-24">
            {image ? (
              <Avatar size={96} image={image} />
            ) : (
              <Image
                accessible={false}
                source={sampleAvatar}
                style={{ width: 96, height: 96, borderRadius: 48 }}
              />
            )}
            <View className="absolute left-[66px] top-[66px] size-8 items-center justify-center rounded-full border-2 border-bg-surface bg-accent-rose">
              <SocialIcon name={CAMERA} size={18} color="white" />
            </View>
          </View>
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel="写真を変更（準備中）"
            accessibilityState={{ disabled: true }}
          >
            <Text className="font-maru-bold text-label text-accent-rose">写真を変更</Text>
          </View>
        </View>
        <View className="gap-3.5">
          <Field label="表示名">
            <TextInput
              accessibilityLabel="表示名"
              value={name}
              onChangeText={setName}
              editable={!save.isPending}
              autoComplete="name"
              maxLength={40}
              className="p-0 font-maru text-ui text-ink-primary"
            />
          </Field>
          <Field label="ユーザーID">
            <TextInput
              accessibilityLabel="ユーザーID（準備中）"
              editable={false}
              placeholder="@hana_makeup"
              placeholderTextColor={secondary}
              className="p-0 font-maru text-ui text-ink-primary"
            />
          </Field>
          <Field label="自己紹介" caption="42文字まで">
            <TextInput
              accessibilityLabel="自己紹介（準備中）"
              editable={false}
              placeholder="丸顔さん向けのメイクを投稿しています"
              placeholderTextColor={secondary}
              className="p-0 font-maru text-ui text-ink-primary"
            />
          </Field>
        </View>
        <Section title="メイクの情報">
          <Row label="顔タイプ" value="丸顔×イエベ" />
        </Section>
        <Section title="公開と通知">
          <SwitchRow title="プロフィールを公開" detail="オフならフォロワーだけに表示します" />
          <Divider />
          <SwitchRow title="新着の通知" detail="フォロー中の人の投稿をお知らせします" />
        </Section>
        <Section title="アカウント">
          <Row label="メールアドレス" value={email} />
          <Divider />
          <Row label="連携アカウント" />
        </Section>
        <AppSection />
        {error ? (
          <Text accessibilityRole="alert" className="font-maru text-meta text-accent-rose">
            {error.message}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: logout.isPending }}
          disabled={logout.isPending}
          onPress={() => {
            logout.mutate();
          }}
          className="min-h-12 items-center justify-center rounded-full border border-black active:opacity-70"
        >
          <Text className="font-maru-bold text-label text-ink-primary">ログアウト</Text>
        </Pressable>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel="アカウントを削除（準備中）"
          accessibilityState={{ disabled: true }}
          className="min-h-12 justify-center"
        >
          <Text className="text-center font-maru-bold text-label text-accent-rose">
            アカウントを削除
          </Text>
        </View>
      </ScrollView>
      <BottomCta>
        {canSave ? (
          <PrimaryButton
            label="保存する"
            onPress={() => {
              save.mutate();
            }}
          />
        ) : (
          // Shown as not ready until the name changes; it also stays inactive while saving.
          <PrimaryButton label={save.isPending ? '保存中' : '保存する'} />
        )}
      </BottomCta>
    </>
  );
}

function Field({
  label,
  caption,
  children,
}: {
  label: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text className="font-maru-bold text-label text-ink-primary">{label}</Text>
      <View className="min-h-12 justify-center rounded-2xl border border-black bg-bg-surface px-3.5 py-[13px]">
        {children}
      </View>
      {caption ? <Text className="font-maru text-meta text-ink-secondary">{caption}</Text> : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="font-maru-bold text-heading text-ink-primary">
        {title}
      </Text>
      <View className="overflow-hidden rounded-[18px] border-[1.5px] border-line-soft bg-bg-surface">
        {children}
      </View>
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-line-soft" />;
}

// A Plan A list row. Without onPress it shows as not built yet.
function Row({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) {
  const ink = useTokenColor('--color-ink-primary');
  const disabled = !onPress;
  const description = value ? `${label} ${value}` : label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={disabled ? `${description}（準備中）` : description}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="min-h-[52px] flex-row items-center gap-2 py-2 pl-3.5 pr-3 active:opacity-70"
    >
      <Text className="flex-1 font-maru-bold text-label text-ink-primary">{label}</Text>
      {value ? (
        <Text className="shrink font-maru text-meta text-ink-secondary">{value}</Text>
      ) : null}
      <SocialIcon name={NEXT} size={18} color={ink} />
    </Pressable>
  );
}

function SwitchRow({ title, detail }: { title: string; detail: string }) {
  const rose = useTokenColor('--color-accent-rose');
  return (
    <View className="min-h-[62px] flex-row items-center gap-2 py-3 pl-3.5 pr-3">
      <View className="flex-1 gap-px">
        <Text className="font-maru-bold text-label text-ink-primary">{title}</Text>
        <Text className="font-maru text-meta text-ink-secondary">{detail}</Text>
      </View>
      {/* Shown on as in Plan A; publishing and notifications are not built yet. */}
      <Switch
        accessibilityLabel={`${title}（準備中）`}
        accessibilityHint={detail}
        // RN's Switch does not report a disabled state to screen readers on its own.
        accessibilityState={{ disabled: true, checked: true }}
        disabled
        value
        trackColor={{ true: rose }}
      />
    </View>
  );
}

// Not in Plan A: the starter's app settings (appearance, haptics, passkeys) need an entry.
function AppSection() {
  return (
    <Section title="アプリ">
      <Row
        label="アプリの設定"
        value="外観・触覚・パスキー"
        onPress={() => {
          router.push('/settings');
        }}
      />
    </Section>
  );
}
