import type { MakeupShape, PostAnalysis } from '@starter/shared';

import { Icon } from '@expo/ui';
import { recipeStepsMax } from '@starter/shared';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Cosmetic, PostDraft, PostStep } from '@/components/post-draft';
import type { PlannedStep } from '@/lib/post-steps';

import { FaceScene } from '@/components/face-scene';
import { GlassIconButton } from '@/components/glass-icon-button';
import { cutStepFrame, usePostDraft } from '@/components/post-draft';
import { arPhotos, partColors } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { apiUrl } from '@/lib/api';
import { cheekShape, plainCheek } from '@/lib/cheek-shape';
import { backOrHome } from '@/lib/navigation';
import { analyzePostVideo, shrinkVideo } from '@/lib/post-analysis';
import { planSteps } from '@/lib/post-steps';
import { regionShape } from '@/lib/region-shape';
import { cn } from '@/lib/utils';

const CLOSE = Icon.select({ ios: 'xmark', android: import('@expo/material-symbols/close.xml') });
const CHECK = Icon.select({
  ios: 'checkmark',
  android: import('@expo/material-symbols/check.xml'),
});

const markStages = ['動画を読み込む', '手順の区切りを確認する', '手順の場面を切り出す'];
const analysisStages = ['動画を読み込む', '動画から手順を読み取る', '手順の場面を切り出す'];
const shrinkStages = [
  '動画を読み込む',
  '動画を縮める',
  '動画から手順を読み取る',
  '手順の場面を切り出す',
];

/** A step ⑫-3 is about to make, with what the analysis found when there was one. */
type Planned = PlannedStep & {
  description: string;
  cosmetics: Cosmetic[];
  shape: MakeupShape | null;
  color: PostStep['color'];
};
type Plan = { steps: Planned[]; analyzed: boolean };

function planFromMarks(video: NonNullable<PostDraft['video']>): Plan {
  return {
    steps: planSteps(video.marks, video.durationMs).map((step) => ({
      ...step,
      description: '',
      cosmetics: [],
      shape: null,
      color: null,
    })),
    analyzed: false,
  };
}

/** The steps Gemini found, in order, cut to the video and to the API's step limit. */
function planFromAnalysis(analysis: PostAnalysis, durationMs: number | null): Plan | null {
  const steps = analysis.steps
    // A step that ends before it starts is a misreading; it would make a negative segment.
    .filter((step) => step.end > step.start)
    .sort((a, b) => a.start - b.start)
    .slice(0, recipeStepsMax)
    .map((step) => {
      const endMs = Math.round(step.end * 1000);
      return {
        part: step.part,
        startMs: Math.round(step.start * 1000),
        endMs: durationMs === null ? endMs : Math.min(endMs, durationMs),
        description: step.description,
        // Blush is drawn from the type Gemini chose, a soft area; landmarks drew it small,
        // hard-edged or on the eyelids (#224).
        shape:
          step.part === 'cheek'
            ? cheekShape(step.cheek ?? plainCheek)
            : regionShape(step.regions, step.part),
        // The color read from the video is a guess the user checks on ⑫-5 (#203).
        color: step.color ? { hex: step.color, picked: false } : null,
        // The cosmetics Gemini saw in the step start chosen; the user removes wrong ones on ⑫-5.
        cosmetics: step.cosmetics.flatMap((index) => {
          const found = analysis.cosmetics[index];
          return found
            ? [
                {
                  id: `analysis-${index}`,
                  name: [found.brand, found.name].filter(Boolean).join(' '),
                  category: found.category,
                  shade: '',
                  color: step.color ?? partColors[step.part],
                },
              ]
            : [];
        }),
      };
    });
  return steps.length > 0 ? { steps, analyzed: true } : null;
}

// Plan A ⑫-3 手順書を作成中. Right before the video leaves the device, a native alert asks to send
// it (#81); the API reads it with Gemini (#142) and its steps, texts and cosmetics fill the draft.
// やめる returns to ⑫-1. Without an API, or when the analysis fails, the steps are made from the
// marks and the user fills them on ⑫-5. Each step gets the frame at its start, cut on the device.
export function PostCreating() {
  const insets = useSafeAreaInsets();
  const { draft, setDraft, trackFile } = usePostDraft();
  const video = draft.video;
  const [sending, setSending] = useState(false);
  // How far a video over the API's limit has been shrunk (0–1); null when it is not being shrunk.
  const [shrinking, setShrinking] = useState<number | null>(null);
  const [shrunk, setShrunk] = useState(false);
  const [analyzedPlan, setPlan] = useState<Plan | null>(null);
  // Without an API nothing is sent or asked; the steps come from the marks right away.
  const markPlan = useMemo(() => (video && !apiUrl ? planFromMarks(video) : null), [video]);
  const plan = analyzedPlan ?? markPlan;
  const [cut, setCut] = useState(0);
  const asked = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!video || !apiUrl || asked.current) {
      return;
    }
    asked.current = true;
    const send = () => {
      const controller = new AbortController();
      request.current = controller;
      setSending(true);
      shrinkVideo(video.uri, controller.signal, setShrinking)
        .then((uri) => {
          if (uri !== video.uri) {
            // The shrunk copy is deleted with the draft's other files when the flow closes.
            trackFile(uri);
            setShrunk(true);
          }
          setShrinking(null);
          return analyzePostVideo({ uri, marks: video.marks }, controller.signal);
        })
        .then(
          (analysis) => {
            const analyzed = planFromAnalysis(analysis, video.durationMs);
            if (!analyzed) {
              // Gemini saw no makeup, e.g. in a test clip; say so instead of quietly falling back.
              Alert.alert(
                '動画からメイクの手順を見つけられませんでした',
                '区切りから手順を作ります。',
              );
              setSending(false);
              setPlan(planFromMarks(video));
              return;
            }
            if (analysis.title) {
              setDraft((current) => ({ ...current, title: current.title || analysis.title }));
            }
            setPlan(analyzed);
          },
          (error: unknown) => {
            if (controller.signal.aborted) {
              return;
            }
            const message = error instanceof Error ? error.message : '';
            Alert.alert('動画から手順書を作れませんでした', `${message}区切りから手順を作ります。`);
            setSending(false);
            setShrinking(null);
            setPlan(planFromMarks(video));
          },
        );
    };
    Alert.alert(
      '動画を送って手順書を作りますか',
      'サーバーに送信しGeminiで動画より手順と使ったコスメを読み取ります。動画はサーバーに残しません。',
      [
        { text: 'やめる', style: 'cancel', onPress: backOrHome },
        { text: '送る', onPress: send },
      ],
      { cancelable: true, onDismiss: backOrHome },
    );
  }, [video, setDraft, trackFile]);
  useEffect(() => {
    if (!video || !plan) {
      return;
    }
    let active = true;
    const cutFrames = async () => {
      const images: (string | null)[] = [];
      for (const step of plan.steps) {
        // A frame that cannot be cut leaves the step without a photo instead of stopping the post.
        const image = await cutStepFrame(
          video.uri,
          { startMs: step.startMs, endMs: step.endMs },
          0.5,
          trackFile,
        );
        if (!active) {
          return;
        }
        images.push(image);
        setCut(images.length);
      }
      setDraft((current) => ({
        ...current,
        steps: plan.steps.map((step, index) => ({
          part: step.part,
          title: '',
          description: step.description,
          cosmetics: step.cosmetics,
          segment: { startMs: step.startMs, endMs: step.endMs },
          image: images[index] ?? null,
          shape: step.shape,
          color: step.color,
        })),
      }));
      router.replace('/post/review');
    };
    void cutFrames();
    return () => {
      active = false;
    };
  }, [video, plan, setDraft, trackFile]);
  if (!video) {
    return (
      <View
        className="flex-1 items-center justify-center gap-4 bg-white px-6"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <Text className="text-center font-maru-bold text-heading text-ink-primary">
          動画がありません
        </Text>
        <Text className="text-center font-maru text-ui text-ink-secondary">
          撮影するか、動画を選んでからお試しください
        </Text>
        <GlassIconButton
          icon={CLOSE}
          label="閉じる"
          onPress={() => {
            backOrHome();
          }}
        />
      </View>
    );
  }
  let stages = markStages;
  if (shrunk || shrinking !== null) {
    stages = shrinkStages;
  } else if (sending || plan?.analyzed) {
    stages = analysisStages;
  }
  const total = plan?.steps.length ?? 0;
  // Reading the video takes the first half of the bar; cutting the frames, the rest.
  let progress = sending ? 25 : 0;
  if (shrinking !== null) {
    progress = Math.round(5 + shrinking * 20);
  }
  if (plan) {
    progress = Math.round((sending ? 50 : 0) + (cut / Math.max(total, 1)) * (sending ? 50 : 100));
  }
  // Loading the video and finding the steps are done once the frames are being cut.
  let done = shrunk ? 2 : 1;
  if (plan) {
    done = cut === total ? stages.length : stages.length - 1;
  }
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <FaceScene photo={arPhotos.camera}>
        <View className="absolute inset-0 bg-white/25" />
      </FaceScene>
      {/* Plan A has no close here; leaving stops making the steps and discards the draft. */}
      <View className="absolute left-4" style={{ top: insets.top + 8 }}>
        <GlassIconButton
          icon={CLOSE}
          label="閉じる"
          onPress={() => {
            backOrHome();
          }}
        />
      </View>
      <View
        className="absolute inset-x-0 bottom-0 gap-4 rounded-t-sheet bg-post-panel px-5 pt-5.5"
        style={{ paddingBottom: Math.max(insets.bottom, 12) + 6 }}
      >
        <View className="flex-row items-center gap-2">
          <Text
            accessibilityRole="header"
            className="flex-1 font-maru-bold text-headline text-ink-primary"
          >
            手順書を作っています
          </Text>
          <Text className="font-maru-bold text-headline text-accent-rose">{progress}%</Text>
        </View>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="手順書の作成"
          accessibilityValue={{ min: 0, max: 100, now: progress }}
          className="h-2.5 overflow-hidden rounded-compact bg-ink-primary/15"
        >
          <View
            className="h-full rounded-compact bg-accent-rose"
            style={{ width: `${progress}%` }}
          />
        </View>
        <View className="gap-2.5">
          {stages.map((stage, index) => (
            <Stage key={stage} label={stage} state={stageState(index, done)} />
          ))}
        </View>
        <Text className="font-maru text-meta text-ink-secondary">
          {plan
            ? `${plan.analyzed ? '動画から' : '区切りごとに'}${total}つの手順を作ります。閉じると作成をやめます`
            : '動画から手順を読み取っています。閉じると作成をやめます'}
        </Text>
      </View>
    </View>
  );
}

type StageState = 'done' | 'current' | 'todo';

function stageState(index: number, done: number): StageState {
  if (index < done) {
    return 'done';
  }
  return index === done ? 'current' : 'todo';
}

function Stage({ label, state }: { label: string; state: StageState }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}、${{ done: '完了', current: '処理中', todo: '待機中' }[state]}`}
      className="flex-row items-center gap-2.5"
    >
      {state === 'done' ? (
        <View className="size-5.5 items-center justify-center rounded-full bg-accent-rose">
          <SocialIcon name={CHECK} size={14} color="white" />
        </View>
      ) : (
        <View
          className={cn(
            'size-5.5 rounded-full border-2',
            state === 'current' ? 'border-accent-rose' : 'border-ink-primary/30',
          )}
        />
      )}
      <Text
        className={cn(
          'flex-1',
          state === 'todo'
            ? 'font-maru text-ui text-ink-secondary'
            : 'font-maru-bold text-label text-ink-primary',
        )}
      >
        {label}
      </Text>
    </View>
  );
}
