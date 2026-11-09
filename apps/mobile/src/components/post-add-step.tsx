import type { VideoPlayer } from 'expo-video';

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { Segment } from '@/lib/post-steps';

import { useCutStepFrame, usePostDraft } from '@/components/post-draft';
import { RangeBar } from '@/components/post-segment';
import { Text } from '@/components/ui/text';
import { VideoBox } from '@/components/video-box';
import { insertSegment, minSegmentMs } from '@/lib/post-steps';
import { cn } from '@/lib/utils';

/** Moves the player to `ms`; expo-video seeks when its current time is set. */
function seekTo(player: VideoPlayer, ms: number) {
  player.currentTime = ms / 1000;
}

/** The second half of the last step, at least `minSegmentMs` long, or the start of the video. */
function initialRange(last: Segment | undefined, durationMs: number | null) {
  const endMs = last?.endMs ?? durationMs ?? minSegmentMs;
  const startMs = last ? Math.round((last.startMs + endMs) / 2) : 0;
  return { startMs: Math.min(startMs, Math.max(endMs - minSegmentMs, 0)), endMs };
}

/**
 * ⑫-4 (#186): 手順を追加. The user picks the new step's start and end with the two ends of a bar over
 * the whole video, as on ⑫-5, while the video shows the moment; 追加 inserts it (`insertSegment`),
 * cutting back the steps it overlaps, and opens the new step on ⑫-5. The video stays on the device.
 */
export function AddStepPanel({ onClose }: { onClose: () => void }) {
  const { draft, setDraft } = usePostDraft();
  const cutFrame = useCutStepFrame();
  const video = draft.video;
  const durationMs = video?.durationMs ?? null;
  // Starts as the second half of the last step, where an added step is most often wanted.
  const [range, setRange] = useState(() => initialRange(draft.steps.at(-1)?.segment, durationMs));
  const [aspect, setAspect] = useState<number | null>(null);
  const player = useVideoPlayer(video?.uri ?? null, (created) => {
    created.currentTime = range.startMs / 1000;
  });
  const before = draft.steps.map((step) => step.segment);
  const added = insertSegment(before, range, durationMs);
  const frame = draft.steps.find((step) => step.image)?.image ?? null;
  if (!video || !durationMs) {
    return null;
  }

  const add = () => {
    if (!added) {
      return;
    }
    const { index, segments } = added;
    const moved = (at: number) => segments[at < index ? at : at + 1];
    setDraft((current) => {
      // In a gap there is no step to split; the one before stands in for the part.
      const source = current.steps[index - 1] ?? current.steps[index];
      // The steps after the new one take the segments after it.
      const steps = current.steps.map((step, at) => ({
        ...step,
        segment: moved(at) ?? step.segment,
      }));
      return {
        ...current,
        steps: [
          ...steps.slice(0, index),
          // The new step starts empty, on the same part; the user fills it on ⑫-5.
          {
            part: source?.part ?? 'base',
            title: '',
            description: '',
            cosmetics: [],
            segment: segments[index] ?? range,
            image: null,
            shape: null,
            color: null,
          },
          ...steps.slice(index),
        ],
      };
    });
    cutFrame(index, segments[index] ?? range);
    // A step cut back at its front now starts later, so its frame is cut again.
    before.forEach((segment, at) => {
      const after = moved(at);
      if (after && after.startMs !== segment.startMs) {
        cutFrame(at < index ? at : at + 1, after);
      }
    });
    onClose();
    router.push(`/post/step/${index}`);
  };

  return (
    <View className="gap-3 rounded-card bg-bg-base px-3.5 py-3">
      <Text accessibilityRole="header" className="font-maru-bold text-label text-ink-primary">
        追加する手順の区間
      </Text>
      <VideoBox aspect={aspect} maxHeight={320} className="bg-ink-primary">
        {frame ? (
          // A step's frame gives the video's shape; the video covers it once it is drawn.
          <Image
            accessible={false}
            source={{ uri: frame }}
            contentFit="contain"
            onLoad={({ source }) => {
              if (source.width > 0 && source.height > 0) {
                setAspect(source.width / source.height);
              }
            }}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
        ) : null}
        <VideoView
          player={player}
          nativeControls={false}
          contentFit="contain"
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
      </VideoBox>
      <RangeBar
        segment={range}
        durationMs={durationMs}
        bounds={{ minStartMs: 0, maxEndMs: durationMs }}
        onDrag={(next, edge) => {
          setRange(next);
          player.pause();
          seekTo(player, edge === 'start' ? next.startMs : next.endMs);
        }}
        onDrop={() => {
          // The range is already where the end was let go.
        }}
        onAdjust={setRange}
      />
      {added ? null : (
        <Text accessibilityLiveRegion="polite" className="font-maru text-meta text-ink-secondary">
          この区間では追加できません。ほかの手順がまるごと隠れるか、1秒より短くなります
        </Text>
      )}
      <View className="flex-row justify-end gap-2">
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          className="min-h-12 justify-center rounded-full px-4 active:opacity-70"
        >
          <Text className="font-maru-bold text-label text-ink-secondary">キャンセル</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !added }}
          disabled={!added}
          onPress={add}
          className={cn(
            'min-h-12 justify-center rounded-full bg-accent-rose px-5 active:opacity-70',
            !added && 'opacity-50',
          )}
        >
          <Text className="font-maru-bold text-label text-white">追加</Text>
        </Pressable>
      </View>
    </View>
  );
}
