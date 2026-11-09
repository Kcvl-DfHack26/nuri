import type { ImagePickerAsset } from 'expo-image-picker';
import type { ReactNode } from 'react';

import { Host, Icon, Switch as NativeSwitch } from '@expo/ui';
import {
  faceTypeIds,
  profileChangesSchema,
  profileInputSchema,
  profilePhotoMaxBytes,
  profilePatchSchema,
} from '@starter/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  launchImageLibraryAsync,
  UIImagePickerPreferredAssetRepresentationMode,
} from 'expo-image-picker';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FaceType } from '@/lib/face-diagnosis';
import type { MyProfile } from '@/lib/social';

import { FaceTypeMenu } from '@/components/face-type-menu';
import { Feedback } from '@/components/feedback';
import { FloatingBackHeader } from '@/components/floating-back-header';
import { ProfilePhoto } from '@/components/my-page';
import { BottomCta, PrimaryButton } from '@/components/post-chrome';
import { PushSettings } from '@/components/push-settings';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { apiUrl, authClient } from '@/lib/api';
import { faceTypes } from '@/lib/face-diagnosis';
import { backOrHome } from '@/lib/navigation';
import { addPasskey, passkeyListOptions, passkeysAvailable } from '@/lib/passkeys';
import { recipeKeys } from '@/lib/recipes';
import {
  changeProfile,
  changeProfileWithPhoto,
  myProfileKeys,
  myProfileOptions,
  userKeys,
} from '@/lib/social';
import { useTokenColor } from '@/theme/tokens';

const CAMERA = Icon.select({
  ios: 'camera',
  android: import('@expo/material-symbols/photo_camera.xml'),
});
const NEXT = Icon.select({
  ios: 'chevron.right',
  android: import('@expo/material-symbols/chevron_right.xml'),
});

// Plan A ⑰-2 プロフィール設定.
export function ProfileSettings() {
  const insets = useSafeAreaInsets();
  const session = authClient.useSession();
  // The header floats over the form; measure it so larger text never covers the first field.
  const [headerHeight, setHeaderHeight] = useState(44);
  const user = session.data?.user;
  const profile = useQuery({ ...myProfileOptions(user?.id), enabled: Boolean(user && apiUrl) });
  return (
    <View className="flex-1 bg-white">
      <ProfileStatusBar />
      {session.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator accessibilityLabel="読み込み中" />
        </View>
      ) : user && !apiUrl ? (
        <Feedback fullScreen message="接続先が未設定です。" />
      ) : user && profile.isPending ? (
        <Feedback fullScreen loading message="プロフィールを読み込んでいます" />
      ) : user && profile.isError && !profile.data ? (
        <Feedback
          fullScreen
          message={profile.error.message}
          onRetry={() => {
            void profile.refetch();
          }}
        />
      ) : user && profile.data && session.data ? (
        <Editor
          key={user.id}
          profile={profile.data}
          userId={user.id}
          sessionId={session.data.session.id}
          email={user.email}
          image={user.image}
          top={insets.top + headerHeight + 16}
          refreshError={profile.isError}
          onRetry={() => {
            void profile.refetch();
          }}
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
        </ScrollView>
      )}
      <FloatingBackHeader
        title="プロフィール設定"
        insetTop={insets.top}
        height={headerHeight}
        topOffset={8}
        onHeight={setHeaderHeight}
      />
    </View>
  );
}

function ProfileStatusBar() {
  // The screen stays mounted under the app settings; only claim the status bar while shown.
  return useIsFocused() ? <StatusBar style="dark" /> : null;
}

function Editor({
  profile,
  userId,
  sessionId,
  email,
  image,
  top,
  refreshError,
  onRetry,
}: {
  profile: MyProfile;
  userId: string;
  sessionId: string;
  email: string;
  image: string | null | undefined;
  top: number;
  refreshError: boolean;
  onRetry: () => void;
}) {
  const [photo, setPhoto] = useState<ImagePickerAsset>();
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string>();
  const saving = useRef(false);
  useEffect(() => {
    // The web picker creates a blob URL for the local preview.
    if (Platform.OS === 'web' && photo?.uri.startsWith('blob:')) {
      const uri = photo.uri;
      return () => {
        URL.revokeObjectURL(uri);
      };
    }
  }, [photo]);
  const [form, setForm] = useState(() => ({ base: profile, draft: profile }));
  const current = {
    name: form.draft.name === form.base.name ? profile.name : form.draft.name,
    handle: form.draft.handle === form.base.handle ? profile.handle : form.draft.handle,
    bio: form.draft.bio === form.base.bio ? profile.bio : form.draft.bio,
    isPublic: form.draft.isPublic === form.base.isPublic ? profile.isPublic : form.draft.isPublic,
    faceType: form.draft.faceType === form.base.faceType ? profile.faceType : form.draft.faceType,
  };
  const change = (patch: Partial<typeof current>) => {
    setForm({ base: profile, draft: { ...current, ...patch } });
  };
  const client = useQueryClient();
  const secondary = useTokenColor('--color-ink-secondary');
  const trimmedHandle = current.handle?.trim();
  const input = { ...current, handle: trimmedHandle === '' ? null : (trimmedHandle ?? null) };
  const changes = {
    ...(input.name !== profile.name ? { name: input.name } : {}),
    ...(input.handle !== profile.handle ? { handle: input.handle } : {}),
    ...(input.bio !== profile.bio ? { bio: input.bio } : {}),
    ...(input.isPublic !== profile.isPublic ? { isPublic: input.isPublic } : {}),
    ...(input.faceType !== profile.faceType ? { faceType: input.faceType } : {}),
  };
  const handleInvalid =
    input.handle !== null && !profileInputSchema.shape.handle.safeParse(input.handle).success;
  const save = useMutation({
    mutationFn: () => (photo ? changeProfileWithPhoto(changes, photo) : changeProfile(changes)),
    onSuccess: async () => {
      authClient.$store.notify('$sessionSignal');
      await Promise.all([
        client.invalidateQueries({ queryKey: recipeKeys.all }),
        client.invalidateQueries({ queryKey: userKeys.all }),
        client.invalidateQueries({ queryKey: myProfileKeys.all }),
      ]);
    },
    onSettled: () => {
      saving.current = false;
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
  const busy = pickingPhoto || save.isPending || logout.isPending;
  const canSave =
    !busy &&
    !refreshError &&
    (photo ? profileChangesSchema : profilePatchSchema).safeParse(changes).success;
  async function pickPhoto() {
    setPhotoError(undefined);
    setPickingPhoto(true);
    try {
      const selected = await pickProfilePhoto();
      if (selected) {
        setPhoto(selected);
        save.reset();
      }
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : photoPickerError);
    } finally {
      setPickingPhoto(false);
    }
  }
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
        {refreshError ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            className="min-h-12 justify-center"
          >
            <Text className="font-maru text-meta text-accent-rose">
              最新のプロフィールを読み込めませんでした。再試行
            </Text>
          </Pressable>
        ) : null}
        <ProfilePhotoEditor
          image={image}
          photoUri={photo?.uri}
          busy={busy}
          pickingPhoto={pickingPhoto}
          photoError={photoError}
          onPick={() => {
            void pickPhoto();
          }}
          onCancel={() => {
            setPhoto(undefined);
            setPhotoError(undefined);
            save.reset();
          }}
        />
        <View className="gap-3.5">
          <Field label="表示名">
            <TextInput
              accessibilityLabel="表示名"
              value={current.name}
              onChangeText={(name) => {
                change({ name });
              }}
              editable={!save.isPending}
              autoComplete="name"
              maxLength={40}
              className="p-0 font-maru text-ui text-ink-primary"
            />
          </Field>
          <Field
            label="ユーザーID"
            caption={
              handleInvalid
                ? 'ユーザーIDは半角英小文字・数字・_で3〜20文字にしてください'
                : '半角英小文字・数字・_で3〜20文字。空欄も可'
            }
            error={handleInvalid}
          >
            <TextInput
              accessibilityLabel="ユーザーID"
              value={current.handle ?? ''}
              onChangeText={(handle) => {
                change({ handle });
              }}
              editable={!save.isPending}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              placeholder="hana_makeup"
              placeholderTextColor={secondary}
              className="p-0 font-maru text-ui text-ink-primary"
            />
          </Field>
          <Field label="自己紹介" caption="42文字まで">
            <TextInput
              accessibilityLabel="自己紹介"
              value={current.bio}
              onChangeText={(bio) => {
                change({ bio });
              }}
              editable={!save.isPending}
              maxLength={42}
              placeholder="丸顔さん向けのメイクを投稿しています"
              placeholderTextColor={secondary}
              className="p-0 font-maru text-ui text-ink-primary"
            />
          </Field>
        </View>
        <Section title="メイクの情報">
          <FaceTypeRow
            value={current.faceType}
            onChange={(faceType) => {
              change({ faceType });
            }}
            disabled={save.isPending}
          />
        </Section>
        <Section title="公開と通知">
          <SwitchRow
            title="プロフィールを公開"
            detail="オフならプロフィール画面は本人のみ。公開投稿・レシピの名前と写真は表示されます"
            value={current.isPublic}
            onValueChange={(isPublic) => {
              change({ isPublic });
            }}
            disabled={save.isPending}
          />
          <Divider />
          <PushSettings sessionId={sessionId} />
        </Section>
        <AccountSection userId={userId} email={email} />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => {
            // Show only the latest failure.
            save.reset();
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
        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            className="mb-2 text-center font-maru text-meta text-accent-rose"
          >
            {error.message}
          </Text>
        ) : null}
        {/* Inactive until a valid field changes, and while saving. */}
        <PrimaryButton
          label={save.isPending ? '保存中' : '保存する'}
          disabled={!canSave}
          onPress={() => {
            if (saving.current) {
              return;
            }
            saving.current = true;
            logout.reset();
            save.mutate(undefined, { onSuccess: backOrHome });
          }}
        />
      </BottomCta>
    </>
  );
}

function ProfilePhotoEditor({
  image,
  photoUri,
  busy,
  pickingPhoto,
  photoError,
  onPick,
  onCancel,
}: {
  image: string | null | undefined;
  photoUri: string | undefined;
  busy: boolean;
  pickingPhoto: boolean;
  photoError: string | undefined;
  onPick: () => void;
  onCancel: () => void;
}) {
  return (
    <View className="items-center gap-2">
      <View className="size-24">
        <ProfilePhoto size={96} image={photoUri ?? image} />
        <View className="absolute left-16.5 top-16.5 size-8 items-center justify-center rounded-full border-2 border-bg-surface bg-accent-rose">
          <SocialIcon name={CAMERA} size={18} color="white" />
        </View>
      </View>
      <View className="flex-row flex-wrap justify-center gap-x-4">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy: pickingPhoto }}
          className="min-h-12 min-w-12 items-center justify-center active:opacity-70"
          disabled={busy}
          onPress={onPick}
        >
          <Text className="font-maru-bold text-label text-accent-rose">
            {pickingPhoto ? '写真を選択中' : '写真を変更'}
          </Text>
        </Pressable>
        {photoUri ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            className="min-h-12 min-w-12 items-center justify-center active:opacity-70"
            disabled={busy}
            onPress={onCancel}
          >
            <Text className="font-maru-bold text-label text-ink-secondary">選択を取り消す</Text>
          </Pressable>
        ) : null}
      </View>
      {photoUri ? (
        <Text className="text-center font-maru text-meta text-ink-secondary">
          保存すると新しい写真が表示されます
        </Text>
      ) : null}
      {photoError ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-center font-maru text-meta text-accent-rose"
        >
          {photoError}
        </Text>
      ) : null}
    </View>
  );
}

const photoPickerError = '写真を選べませんでした。もう一度お試しください。';

async function pickProfilePhoto() {
  const picked = await launchImageLibraryAsync({
    mediaTypes: 'images',
    quality: 0.8,
    preferredAssetRepresentationMode: UIImagePickerPreferredAssetRepresentationMode.Compatible,
  }).catch(() => {
    throw new Error(photoPickerError);
  });
  const selected = picked.assets?.[0];
  if (!selected || (selected.fileSize ?? selected.file?.size ?? 0) <= profilePhotoMaxBytes) {
    return selected;
  }
  if (Platform.OS === 'web' && selected.uri.startsWith('blob:')) {
    URL.revokeObjectURL(selected.uri);
  }
  throw new Error('写真は5 MB以下にしてください。');
}

function Field({
  label,
  caption,
  error,
  children,
}: {
  label: string;
  caption?: string;
  error?: boolean;
  children: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text className="font-maru-bold text-label text-ink-primary">{label}</Text>
      <View className="min-h-12 justify-center rounded-2xl border border-black bg-bg-surface px-3.5 py-3.25">
        {children}
      </View>
      {caption ? (
        <Text
          className={
            error
              ? 'font-maru text-meta text-accent-rose'
              : 'font-maru text-meta text-ink-secondary'
          }
        >
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const faceTypeLabel = '顔タイプ';
const unsetFaceType = { id: 'none', title: '未設定', faceType: null };
const faceTypeOptions = [
  ...faceTypeIds.map((faceType) => ({ id: faceType, title: faceTypes[faceType].label, faceType })),
  unsetFaceType,
];

function FaceTypeRow({
  value,
  onChange,
  disabled,
}: {
  value: FaceType | null;
  onChange: (faceType: FaceType | null) => void;
  disabled: boolean;
}) {
  const selection = faceTypeOptions.find(({ faceType }) => faceType === value) ?? unsetFaceType;
  return (
    <FaceTypeMenu
      label={faceTypeLabel}
      selection={selection}
      options={faceTypeOptions}
      onSelect={(id) => {
        const option = faceTypeOptions.find((choice) => choice.id === id);
        if (option) {
          onChange(option.faceType);
        }
      }}
      disabled={disabled}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className={rowClassName}
        pointerEvents="none"
      >
        <RowContent label={faceTypeLabel} value={selection.title} disclosure />
      </View>
    </FaceTypeMenu>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="font-maru-bold text-heading text-ink-primary">
        {title}
      </Text>
      <View className="overflow-hidden rounded-card border-fine border-line-soft bg-bg-surface">
        {children}
      </View>
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-line-soft" />;
}

const rowClassName = 'min-h-13 flex-row items-center gap-2 py-2 pl-3.5 pr-3';
const rowLabelClassName = 'flex-1 font-maru-bold text-label text-ink-primary';

function RowContent({
  label,
  value,
  disclosure,
  expanded,
}: {
  label: string;
  value?: string | undefined;
  disclosure?: boolean;
  expanded?: boolean | undefined;
}) {
  const ink = useTokenColor('--color-ink-primary');
  return (
    <>
      <Text className={rowLabelClassName}>{label}</Text>
      {value ? (
        <Text className="shrink font-maru text-meta text-ink-secondary">{value}</Text>
      ) : null}
      {disclosure ? (
        <View className={expanded === undefined ? '' : expanded ? '-rotate-90' : 'rotate-90'}>
          <SocialIcon name={NEXT} size={18} color={ink} webGlyph="›" />
        </View>
      ) : null}
    </>
  );
}

// A Plan A list row. A read-only value has no disclosure control.
function Row({
  label,
  value,
  readOnly = false,
  expanded,
  onPress,
}: {
  label: string;
  value?: string;
  readOnly?: boolean;
  expanded?: boolean;
  onPress?: () => void;
}) {
  if (readOnly) {
    return (
      <View className={rowClassName}>
        <RowContent label={label} value={value} />
      </View>
    );
  }

  const disabled = !onPress;
  const description = value ? `${label} ${value}` : label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={disabled ? `${description}（準備中）` : description}
      accessibilityState={{ disabled, expanded }}
      disabled={disabled}
      onPress={onPress}
      className={`${rowClassName} active:opacity-70`}
    >
      <RowContent label={label} value={value} disclosure expanded={expanded} />
    </Pressable>
  );
}

function AccountSection({ userId, email }: { userId: string; email: string }) {
  const [expanded, setExpanded] = useState(false);
  const client = useQueryClient();
  const google = useQuery({
    queryKey: ['google-connection', userId],
    queryFn: async ({ signal }) => {
      const result = await authClient.listAccounts({ fetchOptions: { signal } });
      if (result.error) {
        throw new Error('Google の連携状況を読み込めませんでした。');
      }
      return result.data.some(
        ({ providerId }) => providerId === 'google' || providerId === 'emulate-google',
      );
    },
  });
  const passkeyOptions = passkeyListOptions(userId);
  const keys = useQuery(passkeyOptions);
  const passkeyAction = useMutation({
    mutationFn: async (action: { kind: 'add' } | { kind: 'delete'; id: string }) => {
      if (action.kind === 'add') {
        await addPasskey();
        return;
      }
      const result = await authClient.passkey.deletePasskey({ id: action.id });
      if (result.error) {
        throw new Error('パスキーを削除できませんでした。もう一度お試しください。');
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: passkeyOptions.queryKey, exact: true }),
  });
  const googleStatus = google.isError
    ? '確認できませんでした'
    : google.isPending
      ? '確認中'
      : google.data
        ? '連携済み'
        : '未連携';
  const passkeyStatus = keys.isError
    ? '確認できませんでした'
    : keys.isPending
      ? '確認中'
      : keys.data.length
        ? `${keys.data.length} 件登録済み`
        : '未登録';

  return (
    <Section title="アカウント">
      <Row label="メールアドレス" value={email} />
      <Divider />
      <Row label="Google 連携" value={googleStatus} readOnly />
      <Divider />
      <Row
        label="パスキー"
        value={passkeyStatus}
        expanded={expanded}
        onPress={() => {
          setExpanded((value) => !value);
        }}
      />
      {expanded ? (
        <>
          <Divider />
          <View className="gap-2 px-3.5 py-3">
            <Text className="font-maru text-meta text-ink-secondary">
              顔認証や指紋認証など、端末のロック解除方法でログインできます
            </Text>
            {keys.data?.map((key) => {
              const name = key.name ?? 'パスキー';
              return (
                <View key={key.id} className="flex-row items-center gap-2">
                  <Text className="flex-1 font-maru-bold text-label text-ink-primary">{name}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${name}を削除`}
                    disabled={passkeyAction.isPending}
                    onPress={() => {
                      passkeyAction.mutate({ kind: 'delete', id: key.id });
                    }}
                    className="min-h-12 min-w-12 items-center justify-center px-2 active:opacity-70 disabled:opacity-50"
                  >
                    <Text className="font-maru-bold text-label text-accent-rose">削除</Text>
                  </Pressable>
                </View>
              );
            })}
            <PrimaryButton
              label="この端末にパスキーを追加"
              disabled={passkeyAction.isPending || !passkeysAvailable}
              onPress={() => {
                passkeyAction.mutate({ kind: 'add' });
              }}
            />
            {!passkeysAvailable ? (
              <Text className="font-maru text-meta text-ink-secondary">
                この環境ではパスキーを追加できません
              </Text>
            ) : null}
            {passkeyAction.error ? (
              <Text accessibilityRole="alert" className="font-maru text-meta text-accent-rose">
                {passkeyAction.error.message}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}
      {google.isError || keys.isError ? (
        <>
          <Divider />
          <Row
            label="ログイン方法を再確認"
            onPress={() => {
              if (google.isError) {
                void google.refetch();
              }
              if (keys.isError) {
                void keys.refetch();
              }
            }}
          />
        </>
      ) : null}
    </Section>
  );
}

function SwitchRow({
  title,
  detail,
  value = true,
  onValueChange,
  disabled = false,
}: {
  title: string;
  detail: string;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View className="min-h-15.5 gap-px py-2 pl-3.5 pr-3">
      <Host matchContents={{ vertical: true }} style={{ minHeight: 48 }}>
        <NativeSwitch
          label={onValueChange ? title : `${title}（準備中）`}
          disabled={!onValueChange || disabled}
          value={value}
          onValueChange={onValueChange ?? (() => {})}
        />
      </Host>
      <Text className="font-maru text-meta text-ink-secondary">{detail}</Text>
    </View>
  );
}
