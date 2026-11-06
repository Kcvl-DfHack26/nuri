import { Icon, Switch } from '@expo/ui';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PhotoCrop } from '@/components/recipes';

import { CroppedPhoto } from '@/components/cropped-photo';
import { NativeHost } from '@/components/native-host';
import { PostHeader, PrimaryButton } from '@/components/post-chrome';
import { sampleVideoLength, usePostDraft } from '@/components/post-draft';
import { arPhotos, parts } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

const PLUS = Icon.select({
  ios: 'plus.circle',
  android: import('@expo/material-symbols/add_circle.xml'),
});

const messageLimit = 200;
/** Before and After photos in ⑫-7 and ⑫-9 share Plan A's face crop. */
export const portraitCrop: PhotoCrop = {
  width: '154.25%',
  height: '205.68%',
  left: '-29.51%',
  top: '-40.6%',
};
// Tags come from the sample recipe until tag editing is built.
const sampleTags = ['#狐メイク', '#丸顔', '#15分'];

// Plan A ⑫-7 メッセージを付けて投稿. The message and both publish options are screen state
// in the device-only draft; nothing is sent.
export function PostMessage() {
  const insets = useSafeAreaInsets();
  const { draft, setDraft } = usePostDraft();
  const ink = useTokenColor('--color-ink-primary');
  const secondary = useTokenColor('--color-ink-secondary');
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <PostHeader title="投稿内容" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="gap-3 px-4 pt-3 pb-6"
      >
        <View className="flex-row gap-2.5">
          <Portrait label="Before" source={arPhotos.camera} />
          <Portrait label="After" source={arPhotos.finished} highlighted />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`手順書 ${draft.steps.length}ステップを確認する`}
          onPress={() => {
            router.back();
          }}
          className="min-h-16 flex-row items-center gap-3 rounded-[18px] bg-bg-base py-2 pl-3.5 pr-2.5 active:opacity-80"
        >
          <View className="size-10 items-center justify-center rounded-full bg-bg-surface">
            <Image
              accessible={false}
              source={parts.shading.icon}
              style={{ width: 22, height: 22 }}
            />
          </View>
          <View className="flex-1 gap-px">
            <Text className="font-maru-bold text-label text-ink-primary">
              手順書 {draft.steps.length}ステップ
            </Text>
            <Text className="font-maru text-meta text-ink-secondary">
              動画 {sampleVideoLength} から作成
            </Text>
          </View>
          <Text className="font-maru-bold text-label text-accent-rose">確認する</Text>
        </Pressable>
        <View className="gap-1.5 rounded-[18px] border-[1.5px] border-line-soft bg-bg-surface p-3.5">
          <Text className="font-maru-bold text-label text-ink-secondary">メッセージ</Text>
          <TextInput
            accessibilityLabel="メッセージ"
            multiline
            maxLength={messageLimit}
            placeholder="メイクのポイントを書く"
            placeholderTextColor={secondary}
            value={draft.message}
            onChangeText={(message) => {
              setDraft((current) => ({ ...current, message }));
            }}
            className="min-h-[63px] p-0 font-maru text-ui text-ink-primary"
            style={{ textAlignVertical: 'top' }}
          />
          <Text className="text-right font-maru-bold text-micro text-ink-secondary">
            {draft.message.length}/{messageLimit}
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-1.5">
          {sampleTags.map((tag) => (
            <View
              key={tag}
              className="min-h-[30px] justify-center rounded-full bg-pastel-pink px-3"
            >
              <Text className="font-maru-bold text-label text-accent-rose">{tag}</Text>
            </View>
          ))}
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel="タグを追加（準備中）"
            accessibilityState={{ disabled: true }}
            className="min-h-[30px] flex-row items-center gap-1 rounded-full border-[1.5px] border-line-soft bg-white px-3"
          >
            <SocialIcon name={PLUS} size={14} color={ink} />
            <Text className="font-maru-bold text-label text-ink-primary">タグ</Text>
          </View>
        </View>
        <View className="overflow-hidden rounded-[18px] border-[1.5px] border-line-soft bg-white">
          <PublishOption
            title="使ったコスメを公開"
            detail="商品へのリンクも表示します"
            value={draft.publishCosmetics}
            onChange={(publishCosmetics) => {
              setDraft((current) => ({ ...current, publishCosmetics }));
            }}
          />
          <View className="h-px bg-line-soft" />
          <PublishOption
            title="Before写真を公開"
            detail="オフならAfterだけを表示します"
            value={draft.publishBefore}
            onChange={(publishBefore) => {
              setDraft((current) => ({ ...current, publishBefore }));
            }}
          />
        </View>
      </ScrollView>
      <View className="px-4 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <PrimaryButton
          label="プレビューを見る"
          onPress={() => {
            router.push('/post/preview');
          }}
        />
      </View>
    </View>
  );
}

function Portrait({
  label,
  source,
  highlighted = false,
}: {
  label: string;
  source: number;
  highlighted?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${label}の見本の写真`}
      className="h-[220px] flex-1 overflow-hidden rounded-[20px]"
    >
      <CroppedPhoto source={source} crop={portraitCrop} />
      <View
        className={cn(
          'absolute left-2.5 top-2.5 rounded-[15px] border border-white px-3 py-[5px]',
          highlighted ? 'bg-accent-rose' : 'bg-white/80',
        )}
        style={{ boxShadow: '0px 3px 5px rgba(196, 61, 112, 0.12)' }}
      >
        <Text
          className={cn(
            'font-maru-bold text-label',
            highlighted ? 'text-white' : 'text-ink-primary',
          )}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

function PublishOption({
  title,
  detail,
  value,
  onChange,
}: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View className="min-h-12 flex-row items-center gap-3 px-3.5 py-3">
      <View className="flex-1 gap-px">
        <Text className="font-maru-bold text-label text-ink-primary">{title}</Text>
        <Text className="font-maru text-meta text-ink-secondary">{detail}</Text>
      </View>
      {/* A native switch keeps the OS toggle behavior and accessibility on both platforms. */}
      <NativeHost matchContents>
        <Switch label={title} value={value} onValueChange={onChange} />
      </NativeHost>
    </View>
  );
}
