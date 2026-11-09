import { Icon, Slider } from '@expo/ui';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PhotoCrop } from '@/components/recipes';

import { CroppedPhoto } from '@/components/cropped-photo';
import { NativeHost } from '@/components/native-host';
import { PostHeader, PrimaryButton } from '@/components/post-chrome';
import { usePostDraft } from '@/components/post-draft';
import { arPhotos, parts } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { VideoBox } from '@/components/video-box';
import { addTag, formatClock, lastFrameTime } from '@/lib/post-edit';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

const PLUS = Icon.select({
  ios: 'plus.circle',
  android: import('@expo/material-symbols/add_circle.xml'),
});
const REMOVE = Icon.select({ ios: 'xmark', android: import('@expo/material-symbols/close.xml') });

const titleLimit = 40;
const messageLimit = 200;
const tagLimit = 30;
/** Before and After photos in ⑫-7 and ⑫-9 share Plan A's face crop. */
export const portraitCrop: PhotoCrop = {
  width: '154.25%',
  height: '205.68%',
  left: '-29.51%',
  top: '-40.6%',
};
// Plan A ⑫-7 メッセージを付けて投稿. The title, message, tags, thumbnail and publish option live
// in the device-only draft until ⑫-8 posts it. Plan A has no title field, but a recipe needs one,
// so it sits above the message and must be filled before the preview. Before and After stay
// hidden, with 「Before写真を公開」, until they are built; the thumbnail takes their place at the top.
export function PostMessage() {
  const insets = useSafeAreaInsets();
  const { draft, setDraft } = usePostDraft();
  const ink = useTokenColor('--color-ink-primary');
  const secondary = useTokenColor('--color-ink-secondary');
  const [tagInput, setTagInput] = useState('');
  const durationMs = draft.video?.durationMs ?? null;
  const titled = draft.title.trim().length > 0;
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
          className="min-h-16 flex-row items-center gap-3 rounded-card bg-bg-base py-2 pl-3.5 pr-2.5 active:opacity-80"
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
            {durationMs ? (
              <Text className="font-maru text-meta text-ink-secondary">
                動画 {formatClock(durationMs)} から作成
              </Text>
            ) : null}
          </View>
          <Text className="font-maru-bold text-label text-accent-rose">確認する</Text>
        </Pressable>
        <View className="gap-1.5 rounded-card border-fine border-line-soft bg-bg-surface p-3.5">
          <Text className="font-maru-bold text-label text-ink-secondary">タイトル（必須）</Text>
          <TextInput
            accessibilityLabel="タイトル"
            maxLength={titleLimit}
            placeholder="例：丸顔さんの狐メイク"
            placeholderTextColor={secondary}
            value={draft.title}
            onChangeText={(title) => {
              setDraft((current) => ({ ...current, title }));
            }}
            className="min-h-12 p-0 font-maru text-ui text-ink-primary"
          />
          <Text className="text-right font-maru-bold text-micro text-ink-secondary">
            {draft.title.length}/{titleLimit}
          </Text>
        </View>
        <View className="gap-1.5 rounded-card border-fine border-line-soft bg-bg-surface p-3.5">
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
            className="min-h-15.75 p-0 font-maru text-ui text-ink-primary"
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
              className="min-h-7.5 flex-row items-center gap-1 rounded-full bg-pastel-pink pl-3 pr-2 active:opacity-70"
            >
              <Text className="font-maru-bold text-label text-accent-rose">{tag}</Text>
              <SocialIcon name={REMOVE} size={12} color={ink} />
            </Pressable>
          ))}
        </View>
        <View className="min-h-12 flex-row items-center gap-2 rounded-full border-fine border-line-soft bg-white pl-4 pr-1">
          <TextInput
            accessibilityLabel="タグ"
            maxLength={tagLimit}
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
            className="min-h-12 flex-row items-center gap-1 rounded-full px-3 active:opacity-70"
          >
            <SocialIcon name={PLUS} size={14} color={ink} />
            <Text className="font-maru-bold text-label text-ink-primary">追加</Text>
          </Pressable>
        </View>
        <View className="overflow-hidden rounded-card border-fine border-line-soft bg-white">
          <PublishOption
            title="使ったコスメを公開"
            detail="手順に使ったコスメの名前と色を載せます"
            value={draft.publishCosmetics}
            onChange={(publishCosmetics) => {
              setDraft((current) => ({ ...current, publishCosmetics }));
            }}
          />
        </View>
      </ScrollView>
      <View className="px-4 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        {titled ? null : (
          <Text className="pb-2 text-center font-maru text-meta text-ink-secondary">
            タイトルを入力するとプレビューを見られます
          </Text>
        )}
        <PrimaryButton
          label="プレビューを見る"
          disabled={!titled}
          onPress={() => {
            router.push('/post/preview');
          }}
        />
      </View>
    </View>
  );
}

type VideoFrame = { uri: string; timeMs: number };

/**
 * Cuts the frame at a time from the post's video on the device; a later request wins. While the
 * slider moves, the last cut frame stays shown until the next one is ready. `failed` is set when
 * the latest request could not be cut.
 */
function useVideoFrame(videoUri: string | null, timeMs: number | null) {
  const { trackFile } = usePostDraft();
  const [frame, setFrame] = useState<VideoFrame | null>(null);
  const [failedAt, setFailedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!videoUri || timeMs === null) {
      return;
    }
    let active = true;
    getThumbnailAsync(videoUri, { time: timeMs, quality: 0.7 }).then(
      ({ uri }) => {
        trackFile(uri);
        if (active) {
          setFrame({ uri, timeMs });
          setFailedAt(null);
        }
      },
      () => {
        if (active) {
          setFailedAt(timeMs);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [videoUri, timeMs, trackFile]);
  return {
    frame: timeMs === null ? null : frame,
    failed: timeMs !== null && failedAt === timeMs,
  };
}

/** The picked frame, the failure note when no frame could be cut, or Plan A's sample without a video. */
function ThumbnailContent({
  frame,
  hasVideo,
  failed,
  onSize,
}: {
  frame: VideoFrame | null;
  hasVideo: boolean;
  failed: boolean;
  /** The frame's size, so the box can take the video's shape. */
  onSize: (width: number, height: number) => void;
}) {
  if (frame) {
    return (
      <Image
        source={{ uri: frame.uri }}
        contentFit="cover"
        onLoad={({ source }) => {
          if (source.width > 0 && source.height > 0) {
            onSize(source.width, source.height);
          }
        }}
        style={{ flex: 1 }}
      />
    );
  }
  if (!hasVideo) {
    return <CroppedPhoto source={arPhotos.finished} crop={portraitCrop} />;
  }
  return failed ? (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-center font-maru text-label text-ink-secondary">
        場面を切り出せませんでした。タップして別の場面を選んでください
      </Text>
    </View>
  ) : null;
}

// サムネイルの設定: ①'s recipe card photo. It defaults to the video's last frame. Tapping it shows
// the video's timeline below; the frame under the slider is previewed and 決定 keeps it once that
// frame is ready. Without a video Plan A's sample photo stands in.
function ThumbnailPicker() {
  const { draft, setDraft } = usePostDraft();
  const video = draft.video;
  const [editingAt, setEditingAt] = useState<number | null>(null);
  const { frame: defaultFrame, failed: defaultFailed } = useVideoFrame(
    video?.uri ?? null,
    video && !draft.thumbnail ? lastFrameTime(video.durationMs) : null,
  );
  const { frame: preview, failed: previewFailed } = useVideoFrame(video?.uri ?? null, editingAt);
  useEffect(() => {
    if (defaultFrame && !draft.thumbnail) {
      setDraft((current) => ({ ...current, thumbnail: defaultFrame }));
    }
  }, [defaultFrame, draft.thumbnail, setDraft]);
  const thumbnail = draft.thumbnail;
  const shown = editingAt === null ? thumbnail : (preview ?? thumbnail);
  // A failed default frame can still be replaced by picking another moment on the timeline.
  const canEdit = Boolean(video?.durationMs) && (thumbnail !== null || defaultFailed);
  // 決定 keeps only the frame of the moment under the slider, not one still being replaced.
  const ready = preview?.timeMs === editingAt;
  // The frame's shape, so a portrait video's thumbnail is shown portrait (#186).
  const [aspect, setAspect] = useState<number | null>(null);
  const picker = (
    <Pressable
      accessibilityRole={canEdit ? 'button' : 'image'}
      accessibilityLabel={
        shown ? `サムネイル ${formatClock(shown.timeMs)}の場面` : 'サムネイルの見本の写真'
      }
      accessibilityHint={canEdit ? 'サムネイルにする場面を変更します' : undefined}
      disabled={!canEdit || editingAt !== null}
      onPress={() => {
        setEditingAt(thumbnail?.timeMs ?? 0);
      }}
      className={cn(
        'overflow-hidden rounded-panel bg-bg-base active:opacity-90',
        video ? 'flex-1' : 'h-55',
      )}
    >
      <ThumbnailContent
        frame={shown}
        hasVideo={Boolean(video)}
        failed={defaultFailed}
        onSize={(width, height) => {
          setAspect(width / height);
        }}
      />
      {canEdit && editingAt === null ? (
        <View className="absolute bottom-2.5 right-2.5 rounded-overlay-label bg-white/85 px-3 py-1.25">
          <Text className="font-maru-bold text-label text-ink-primary">タップして変更</Text>
        </View>
      ) : null}
    </Pressable>
  );
  return (
    <View className="gap-2">
      <Text className="font-maru-bold text-label text-ink-secondary">サムネイルの設定</Text>
      {video ? (
        <VideoBox aspect={aspect} maxHeight={360}>
          {picker}
        </VideoBox>
      ) : (
        picker
      )}
      {editingAt !== null && video?.durationMs ? (
        <View className="gap-1 rounded-card bg-bg-base px-3.5 py-3">
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
              {formatClock(editingAt)}
            </Text>
            <Text className="font-maru text-meta text-ink-secondary">
              {formatClock(video.durationMs)}
            </Text>
          </View>
          {previewFailed ? (
            <Text
              accessibilityLiveRegion="polite"
              className="font-maru text-meta text-ink-secondary"
            >
              この場面は切り出せませんでした。別の時点を選んでください
            </Text>
          ) : null}
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
              accessibilityState={{ disabled: !ready }}
              disabled={!ready}
              onPress={() => {
                if (ready) {
                  setDraft((current) => ({ ...current, thumbnail: preview }));
                }
                setEditingAt(null);
              }}
              className={cn(
                'min-h-12 justify-center rounded-full bg-accent-rose px-5 active:opacity-70',
                !ready && 'opacity-50',
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
  const pink = useTokenColor('--color-accent-pink');
  const off = useTokenColor('--color-neutral-soft');
  const thumbOff = useTokenColor('--color-bg-surface');
  return (
    <View className="min-h-12 flex-row items-center gap-3 px-3.5 py-3">
      <View className="flex-1 gap-px">
        <Text className="font-maru-bold text-label text-ink-primary">{title}</Text>
        <Text className="font-maru text-meta text-ink-secondary">{detail}</Text>
      </View>
      {/* React Native's OS switch: @expo/ui's Switch always draws its label beside the toggle,
          which would repeat the Plan A title. */}
      <Switch
        accessibilityLabel={title}
        accessibilityHint={detail}
        value={value}
        onValueChange={onChange}
        // The panel's pastel pinks (#224): a light pink track under a rose thumb when on, a soft
        // grey track when off. iOS keeps its white thumb.
        trackColor={{ true: pink, false: off }}
        ios_backgroundColor={off}
        thumbColor={Platform.OS === 'android' ? (value ? rose : thumbOff) : undefined}
      />
    </View>
  );
}
