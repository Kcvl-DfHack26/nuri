import { Icon, Slider } from '@expo/ui';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PhotoCrop } from '@/components/recipes';

import { CroppedPhoto } from '@/components/cropped-photo';
import { NativeHost } from '@/components/native-host';
import { PostHeader, PrimaryButton } from '@/components/post-chrome';
import { sampleVideoLength, usePostDraft } from '@/components/post-draft';
import { arPhotos, parts } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { addTag, lastFrameTime } from '@/lib/post-edit';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

const PLUS = Icon.select({
  ios: 'plus.circle',
  android: import('@expo/material-symbols/add_circle.xml'),
});
const REMOVE = Icon.select({ ios: 'xmark', android: import('@expo/material-symbols/close.xml') });

const messageLimit = 200;
/** Before and After photos in ⑫-7 and ⑫-9 share Plan A's face crop. */
export const portraitCrop: PhotoCrop = {
  width: '154.25%',
  height: '205.68%',
  left: '-29.51%',
  top: '-40.6%',
};
// Plan A ⑫-7 メッセージを付けて投稿. The message, tags, thumbnail and publish option live in the
// device-only draft; nothing is sent. Before and After stay hidden, with 「Before写真を公開」, until
// they are built; the thumbnail takes their place at the top.
export function PostMessage() {
  const insets = useSafeAreaInsets();
  const { draft, setDraft } = usePostDraft();
  const ink = useTokenColor('--color-ink-primary');
  const secondary = useTokenColor('--color-ink-secondary');
  const [tagInput, setTagInput] = useState('');
  const submitTag = () => {
    setDraft((current) => ({ ...current, tags: addTag(current.tags, tagInput) }));
    setTagInput('');
  };
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
        <ThumbnailPicker />
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
          {draft.tags.map((tag) => (
            <Pressable
              key={tag}
              accessibilityRole="button"
              accessibilityLabel={`${tag}を削除`}
              hitSlop={9}
              onPress={() => {
                setDraft((current) => ({
                  ...current,
                  tags: current.tags.filter((item) => item !== tag),
                }));
              }}
              className="min-h-[30px] flex-row items-center gap-1 rounded-full bg-pastel-pink pl-3 pr-2 active:opacity-70"
            >
              <Text className="font-maru-bold text-label text-accent-rose">{tag}</Text>
              <SocialIcon name={REMOVE} size={12} color={ink} />
            </Pressable>
          ))}
        </View>
        <View className="min-h-12 flex-row items-center gap-2 rounded-full border-[1.5px] border-line-soft bg-white pl-4 pr-1">
          <TextInput
            accessibilityLabel="タグ"
            placeholder="タグを入力"
            placeholderTextColor={secondary}
            value={tagInput}
            onChangeText={setTagInput}
            onSubmitEditing={submitTag}
            submitBehavior="submit"
            returnKeyType="done"
            className="flex-1 p-0 font-maru text-ui text-ink-primary"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="タグを追加"
            onPress={submitTag}
            className="min-h-11 flex-row items-center gap-1 rounded-full px-3 active:opacity-70"
          >
            <SocialIcon name={PLUS} size={14} color={ink} />
            <Text className="font-maru-bold text-label text-ink-primary">追加</Text>
          </Pressable>
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

/** m:ss of a frame, read in labels. */
function frameTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

type VideoFrame = { uri: string; timeMs: number };

/** Cuts the frame at a time from the post's video on the device; a later request wins. */
function useVideoFrame(videoUri: string | null, timeMs: number | null) {
  const [frame, setFrame] = useState<VideoFrame | null>(null);
  useEffect(() => {
    if (!videoUri || timeMs === null) {
      return;
    }
    let active = true;
    getThumbnailAsync(videoUri, { time: timeMs, quality: 0.7 }).then(
      ({ uri }) => {
        if (active) {
          setFrame({ uri, timeMs });
        }
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [videoUri, timeMs]);
  // While the slider moves, the last cut frame stays shown until the next one is ready.
  return timeMs === null ? null : frame;
}

// サムネイルの設定: ①'s recipe card photo. It defaults to the video's last frame. Tapping it shows
// the video's timeline below; the frame under the slider is previewed and 決定 keeps it. Without a
// video (recording is not built yet) Plan A's sample photo stands in.
function ThumbnailPicker() {
  const { draft, setDraft } = usePostDraft();
  const video = draft.video;
  const [editingAt, setEditingAt] = useState<number | null>(null);
  const defaultFrame = useVideoFrame(
    video?.uri ?? null,
    video && !draft.thumbnail ? lastFrameTime(video.durationMs) : null,
  );
  const preview = useVideoFrame(video?.uri ?? null, editingAt);
  useEffect(() => {
    if (defaultFrame && !draft.thumbnail) {
      setDraft((current) => ({ ...current, thumbnail: defaultFrame }));
    }
  }, [defaultFrame, draft.thumbnail, setDraft]);
  const thumbnail = draft.thumbnail;
  const shown = editingAt === null ? thumbnail : (preview ?? thumbnail);
  const canEdit = Boolean(video?.durationMs && thumbnail);
  return (
    <View className="gap-2">
      <Text className="font-maru-bold text-label text-ink-secondary">サムネイルの設定</Text>
      <Pressable
        accessibilityRole={canEdit ? 'button' : 'image'}
        accessibilityLabel={
          shown ? `サムネイル ${frameTime(shown.timeMs)}の場面` : 'サムネイルの見本の写真'
        }
        accessibilityHint={canEdit ? 'サムネイルにする場面を変更します' : undefined}
        disabled={!canEdit || editingAt !== null}
        onPress={() => {
          setEditingAt(thumbnail?.timeMs ?? 0);
        }}
        className="h-[220px] overflow-hidden rounded-[20px] bg-bg-base active:opacity-90"
      >
        {shown ? (
          <Image source={{ uri: shown.uri }} contentFit="cover" style={{ flex: 1 }} />
        ) : video ? null : (
          <CroppedPhoto source={arPhotos.finished} crop={portraitCrop} />
        )}
        {canEdit && editingAt === null ? (
          <View className="absolute bottom-2.5 right-2.5 rounded-[15px] bg-white/85 px-3 py-[5px]">
            <Text className="font-maru-bold text-label text-ink-primary">タップして変更</Text>
          </View>
        ) : null}
      </Pressable>
      {editingAt !== null && video?.durationMs ? (
        <View className="gap-1 rounded-[18px] bg-bg-base px-3.5 py-3">
          <NativeHost matchContents={{ vertical: true }} style={{ alignSelf: 'stretch' }}>
            <Slider
              testID="サムネイルの時点"
              value={editingAt}
              min={0}
              max={lastFrameTime(video.durationMs)}
              step={100}
              onValueChange={(value) => {
                setEditingAt(Math.round(value));
              }}
            />
          </NativeHost>
          <View className="flex-row justify-between">
            <Text className="font-maru text-meta text-ink-secondary">0:00</Text>
            <Text
              accessibilityLiveRegion="polite"
              className="font-maru-bold text-meta text-ink-primary"
            >
              {frameTime(editingAt)}
            </Text>
            <Text className="font-maru text-meta text-ink-secondary">
              {frameTime(video.durationMs)}
            </Text>
          </View>
          <View className="flex-row justify-end gap-2">
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setEditingAt(null);
              }}
              className="min-h-12 justify-center rounded-full px-4 active:opacity-70"
            >
              <Text className="font-maru-bold text-label text-ink-secondary">キャンセル</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !preview }}
              disabled={!preview}
              onPress={() => {
                if (preview) {
                  setDraft((current) => ({ ...current, thumbnail: preview }));
                }
                setEditingAt(null);
              }}
              className={cn(
                'min-h-12 justify-center rounded-full bg-accent-rose px-5 active:opacity-70',
                !preview && 'opacity-50',
              )}
            >
              <Text className="font-maru-bold text-label text-white">決定</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
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
  const rose = useTokenColor('--color-accent-rose');
  return (
    <View className="min-h-12 flex-row items-center gap-3 px-3.5 py-3">
      <View className="flex-1 gap-px">
        <Text className="font-maru-bold text-label text-ink-primary">{title}</Text>
        <Text className="font-maru text-meta text-ink-secondary">{detail}</Text>
      </View>
      {/* React Native's OS switch: @expo/ui's Switch always draws its label beside the toggle,
          which would repeat the Plan A title, and follows the device's dark appearance. */}
      <Switch
        accessibilityLabel={title}
        accessibilityHint={detail}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: rose }}
      />
    </View>
  );
}
