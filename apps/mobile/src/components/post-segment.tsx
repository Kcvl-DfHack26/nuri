import type { VideoPlayer } from 'expo-video';
import type { LayoutChangeEvent } from 'react-native';

import { Icon } from '@expo/ui';
import { useEvent, useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { PostStep } from '@/components/post-draft';
import type { Segment } from '@/lib/post-steps';

import { segmentLength, useCutStepFrame, usePostDraft } from '@/components/post-draft';
import { parts } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { VideoBox } from '@/components/video-box';
import { formatClock } from '@/lib/post-edit';
import { minSegmentMs, moveSegment, segmentBounds } from '@/lib/post-steps';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

const PLAY = Icon.select({
  ios: 'play.fill',
  android: import('@expo/material-symbols/play_arrow.xml'),
});
const LEFT = Icon.select({
  ios: 'chevron.left',
  android: import('@expo/material-symbols/chevron_left.xml'),
});
const RIGHT = Icon.select({
  ios: 'chevron.right',
  android: import('@expo/material-symbols/chevron_right.xml'),
});
const PAUSE = Icon.select({
  ios: 'pause.fill',
  android: import('@expo/material-symbols/pause.xml'),
});

export type Edge = 'start' | 'end';
type Range = { startMs: number; endMs: number };

// How far one swipe of a screen reader's adjust gesture moves a boundary.
const adjustStepMs = 1000;

/** Moves the player to `ms`; expo-video seeks when its current time is set. */
function seekTo(player: VideoPlayer, ms: number) {
  player.currentTime = ms / 1000;
}

/**
 * ⑫-5 (#181): the step's part of the video, played on the device only, in the video's own shape,
 * and one bar whose two ends move the step's start and end. Moving them also moves the neighbors
 * (`moveSegment`); a step whose start moved gets its frame cut again.
 */
export function StepSegment({ step, position }: { step: PostStep; position: number }) {
  const { draft, setDraft } = usePostDraft();
  const cutFrame = useCutStepFrame();
  const video = draft.video;
  const durationMs = video?.durationMs ?? null;
  const ink = useTokenColor('--color-ink-primary');
  // The range while an end is being dragged; the draft changes when it is let go.
  const [dragging, setDragging] = useState<Range | null>(null);
  // The frame stands in until the video is played or an end is moved.
  const [showVideo, setShowVideo] = useState(false);
  const [aspect, setAspect] = useState<number | null>(null);
  const segment: Segment = dragging ?? step.segment;
  const player = useVideoPlayer(video?.uri ?? null, (created) => {
    created.timeUpdateEventInterval = 0.1;
    created.currentTime = step.segment.startMs / 1000;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (segment.endMs !== null && currentTime * 1000 >= segment.endMs) {
      player.pause();
    }
  });
  // Leaving ⑫-5, even for ⑫-6 on top of it, stops the video.
  useFocusEffect(
    useCallback(
      () => () => {
        player.pause();
      },
      [player],
    ),
  );
  const failed = status === 'error';
  const canPlay = Boolean(video) && !failed;
  const bounds = segmentBounds(
    draft.steps.map((item) => item.segment),
    position,
    durationMs,
  );

  const togglePlay = () => {
    if (isPlaying) {
      player.pause();
      return;
    }
    const nowMs = player.currentTime * 1000;
    // At the end, or outside the step, play the step again from its start.
    if (nowMs < segment.startMs || (segment.endMs !== null && nowMs >= segment.endMs - 100)) {
      seekTo(player, segment.startMs);
    }
    setShowVideo(true);
    player.play();
  };
  const preview = (range: Range, edge: Edge) => {
    setDragging(range);
    player.pause();
    seekTo(player, edge === 'start' ? range.startMs : range.endMs);
    setShowVideo(true);
  };
  const apply = (change: Range) => {
    setDragging(null);
    if (!video) {
      return;
    }
    const before = draft.steps.map((item) => item.segment);
    const after = moveSegment(before, position, change, durationMs);
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((item, index) => ({
        ...item,
        segment: after[index] ?? item.segment,
      })),
    }));
    // A step that starts elsewhere now shows the frame at its new start.
    after.forEach((moved, index) => {
      if (moved.startMs !== before[index]?.startMs) {
        cutFrame(index, moved);
      }
    });
  };

  return (
    <View className="gap-4">
      <VideoBox aspect={aspect} className="items-center justify-center bg-ink-primary">
        {showVideo && canPlay ? (
          <VideoView
            player={player}
            nativeControls={false}
            contentFit="contain"
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
        ) : (
          <Frame
            step={step}
            onSize={(frameWidth, frameHeight) => {
              setAspect(frameWidth / frameHeight);
            }}
          />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? '区間の再生を止める' : '区間を再生'}
          accessibilityState={{ disabled: !canPlay }}
          disabled={!canPlay}
          onPress={togglePlay}
          className="size-13 items-center justify-center rounded-full bg-bg-surface active:opacity-70 disabled:opacity-50"
        >
          <SocialIcon name={isPlaying ? PAUSE : PLAY} size={28} color={ink} />
        </Pressable>
      </VideoBox>
      {failed ? (
        <Text accessibilityLiveRegion="polite" className="font-maru text-meta text-ink-secondary">
          動画を再生できませんでした
        </Text>
      ) : null}
      <RangeBar
        segment={segment}
        durationMs={durationMs}
        bounds={video && step.segment.endMs !== null ? bounds : null}
        onDrag={preview}
        onDrop={() => {
          if (dragging) {
            apply(dragging);
          }
        }}
        onAdjust={apply}
      />
    </View>
  );
}

/** The step's frame, telling its size so the box can take the video's shape. */
function Frame({
  step,
  onSize,
}: {
  step: Pick<PostStep, 'part' | 'image'>;
  onSize: (width: number, height: number) => void;
}) {
  if (step.image) {
    return (
      <Image
        accessible={false}
        source={{ uri: step.image }}
        contentFit="contain"
        onLoad={({ source }) => {
          if (source.width > 0 && source.height > 0) {
            onSize(source.width, source.height);
          }
        }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
    );
  }
  const part = parts[step.part];
  return (
    <View className={cn('absolute inset-0 items-center justify-center', part.iconBackground)}>
      <Image accessible={false} source={part.icon} style={{ width: 28, height: 28 }} />
    </View>
  );
}

/**
 * Where the step is in the whole video. With `bounds`, its two ends can be dragged, or adjusted a
 * second at a time with a screen reader, to move the step's start and end.
 */
export function RangeBar({
  segment,
  durationMs,
  bounds,
  onDrag,
  onDrop,
  onAdjust,
}: {
  segment: Segment;
  durationMs: number | null;
  bounds: { minStartMs: number; maxEndMs: number } | null;
  /** While an end is dragged, the range it makes. */
  onDrag: (range: Range, edge: Edge) => void;
  /** The drag ended; the range last passed to `onDrag` applies. */
  onDrop: () => void;
  /** A screen reader moved an end to make this range. */
  onAdjust: (range: Range) => void;
}) {
  const { startMs, endMs } = segment;
  const [barWidth, setBarWidth] = useState(0);
  const range = endMs === null ? '' : `${formatClock(startMs)} 〜 ${formatClock(endMs)}`;
  const clamp = (edge: Edge, ms: number): Range | null => {
    if (!bounds || endMs === null) {
      return null;
    }
    if (edge === 'start') {
      const next = Math.min(Math.max(ms, bounds.minStartMs), endMs - minSegmentMs);
      return { startMs: Math.round(next), endMs };
    }
    const next = Math.max(Math.min(ms, bounds.maxEndMs), startMs + minSegmentMs);
    return { startMs, endMs: Math.round(next) };
  };

  return (
    <View className="gap-1.5">
      {durationMs && endMs !== null ? (
        <View
          onLayout={(event: LayoutChangeEvent) => {
            setBarWidth(event.nativeEvent.layout.width);
          }}
          className="h-12 w-full justify-center"
        >
          <View
            accessible
            accessibilityLabel={`動画${formatClock(durationMs)}のうち${range}`}
            className="h-3 w-full overflow-hidden rounded-md bg-ink-primary/15"
          >
            <View
              className="absolute inset-y-0 rounded-md bg-accent-rose"
              style={{
                left: `${(startMs / durationMs) * 100}%`,
                width: `${((endMs - startMs) / durationMs) * 100}%`,
              }}
            />
          </View>
          {bounds
            ? (['start', 'end'] as const).map((edge) => {
                const at = edge === 'start' ? startMs : endMs;
                return (
                  <Handle
                    key={edge}
                    edge={edge}
                    label={edge === 'start' ? '区間の開始' : '区間の終了'}
                    at={at}
                    left={(at / durationMs) * barWidth}
                    msPerPx={barWidth > 0 ? durationMs / barWidth : 0}
                    onMove={(ms) => {
                      const moved = clamp(edge, ms);
                      if (moved) {
                        onDrag(moved, edge);
                      }
                    }}
                    onDrop={onDrop}
                    onAdjust={(ms) => {
                      const moved = clamp(edge, ms);
                      if (moved) {
                        onAdjust(moved);
                      }
                    }}
                  />
                );
              })
            : null}
        </View>
      ) : null}
      <View className="flex-row items-start justify-between gap-2">
        <Text className="font-maru text-meta text-ink-secondary">
          {range || `${formatClock(startMs)} 〜`}
        </Text>
        <Text className="font-maru-bold text-label text-accent-rose">
          区間 {segmentLength({ segment })}
        </Text>
      </View>
    </View>
  );
}

/** One end of the bar: a 48pt target to drag, or to adjust a second at a time with a screen reader. */
function Handle({
  edge,
  label,
  at,
  left,
  msPerPx,
  onMove,
  onDrop,
  onAdjust,
}: {
  edge: Edge;
  label: string;
  at: number;
  /** The end's place on the bar, in px from its left. */
  left: number;
  msPerPx: number;
  onMove: (ms: number) => void;
  onDrop: () => void;
  onAdjust: (ms: number) => void;
}) {
  const ink = useTokenColor('--color-ink-primary');
  // Where a drag started: the finger's x on the screen and the end's time then.
  const [origin, setOrigin] = useState<{ x: number; at: number } | null>(null);
  return (
    <View
      onStartShouldSetResponder={() => true}
      // Keep the drag when the screen around it would scroll.
      onResponderTerminationRequest={() => false}
      onResponderGrant={(event) => {
        setOrigin({ x: event.nativeEvent.pageX, at });
      }}
      onResponderMove={(event) => {
        if (origin) {
          onMove(origin.at + (event.nativeEvent.pageX - origin.x) * msPerPx);
        }
      }}
      onResponderRelease={() => {
        setOrigin(null);
        onDrop();
      }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: formatClock(at) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={({ nativeEvent }) => {
        onAdjust(at + (nativeEvent.actionName === 'increment' ? adjustStepMs : -adjustStepMs));
      }}
      className="absolute size-12 items-center justify-center"
      style={{ left: left - 24 }}
    >
      {/* A white circle with an arrow into the step: > at its start, < at its end. */}
      <View
        className="size-8 items-center justify-center rounded-full bg-white"
        style={{ boxShadow: '0px 1px 4px rgba(67, 48, 75, 0.35)' }}
      >
        <SocialIcon name={edge === 'start' ? RIGHT : LEFT} size={18} color={ink} />
      </View>
    </View>
  );
}
