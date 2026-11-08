import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CroppedPhoto } from '@/components/cropped-photo';
import { PrimaryButton } from '@/components/post-chrome';
import { usedCosmetics, usePostDraft } from '@/components/post-draft';
import { portraitCrop } from '@/components/post-message';
import { arPhotos } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { formatClock } from '@/lib/post-edit';
import { useTokenColor } from '@/theme/tokens';

const SHARE = Icon.select({
  ios: 'square.and.arrow.up',
  android: import('@expo/material-symbols/share.xml'),
});

// Plan A ⑫-9 投稿完了: 投稿を見る opens the saved recipe (⑤) in place of the post flow.
export function PostDone() {
  const insets = useSafeAreaInsets();
  const { draft } = usePostDraft();
  const ink = useTokenColor('--color-ink-primary');
  const durationMs = draft.video?.durationMs;
  const stats = [
    { value: String(draft.steps.length), label: '手順' },
    { value: String(usedCosmetics(draft.steps).length), label: 'コスメ' },
    ...(durationMs ? [{ value: formatClock(durationMs), label: '動画' }] : []),
  ];
  const postedId = draft.postedId;
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="grow items-center justify-center gap-5 px-4"
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: Math.max(insets.bottom, 12) + 24,
        }}
      >
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={draft.thumbnail ? 'サムネイルの写真' : '仕上がりの見本の写真'}
          className="size-55 overflow-hidden rounded-full border-6 border-pastel-pink"
        >
          {draft.thumbnail ? (
            <Image
              accessible={false}
              source={{ uri: draft.thumbnail.uri }}
              contentFit="cover"
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <CroppedPhoto source={arPhotos.finished} crop={portraitCrop} />
          )}
        </View>
        <View className="items-center gap-1.5">
          <Text
            accessibilityRole="header"
            className="text-center font-maru-black text-display text-ink-primary"
          >
            投稿しました！
          </Text>
          <Text className="text-center font-maru text-ui text-ink-secondary">
            みんなが自分の顔で試せるようになりました
          </Text>
        </View>
        <View className="w-full flex-row gap-2.5">
          {stats.map((stat) => (
            <View
              key={stat.label}
              accessible
              accessibilityLabel={`${stat.label} ${stat.value}`}
              className="flex-1 items-center gap-0.5 rounded-card bg-bg-base px-2 py-3"
            >
              <Text className="font-maru-bold text-headline text-ink-primary">{stat.value}</Text>
              <Text className="font-maru text-meta text-ink-secondary">{stat.label}</Text>
            </View>
          ))}
        </View>
        <View className="w-full gap-5">
          <PrimaryButton
            label="投稿を見る"
            disabled={!postedId}
            onPress={() => {
              // Leave the post flow and show the new recipe in its place.
              if (postedId) {
                router.replace(`/recipes/${postedId}`);
              }
            }}
          />
          {/* Sharing a post is not built yet, so it stays inactive. */}
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel="友だちに共有（準備中）"
            accessibilityState={{ disabled: true }}
            className="min-h-13 flex-row items-center justify-center gap-1.5 rounded-full border border-black bg-white px-4.5"
          >
            <SocialIcon name={SHARE} size={20} color={ink} />
            <Text className="font-maru-bold text-action text-ink-primary">友だちに共有</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              router.dismissTo('/');
            }}
            className="min-h-12 items-center justify-center self-center px-4 active:opacity-60"
          >
            <Text className="font-maru-bold text-label text-ink-secondary">ホームに戻る</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
