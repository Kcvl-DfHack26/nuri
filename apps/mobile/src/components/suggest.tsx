import type { ReactNode } from 'react';

import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import {
  CameraType,
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
} from 'expo-image-picker';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PhotoCrop } from '@/components/recipes';
import type { BrowShape, FaceType } from '@/lib/face-diagnosis';

import { CroppedPhoto } from '@/components/cropped-photo';
import { arPhotos } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { diagnoseFace } from '@/lib/face-diagnosis';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

import faceGuide from '../../assets/plan-a/suggest/face-guide.svg';
import FaceTracker from '../../modules/face-tracker/src/FaceTrackerModule';

const SCAN = Icon.select({
  ios: 'faceid',
  android: import('@expo/material-symbols/familiar_face_and_zone.xml'),
});
const CAMERA = Icon.select({
  ios: 'camera',
  android: import('@expo/material-symbols/photo_camera.xml'),
});
const PHOTO = Icon.select({ ios: 'photo', android: import('@expo/material-symbols/image.xml') });
const HISTORY = Icon.select({
  ios: 'clock.arrow.circlepath',
  android: import('@expo/material-symbols/history.xml'),
});

// Plan A draws the hero on a 390×620 frame; the guide and its tag are placed on that frame.
const frame = { width: 390, height: 620 };
const heroCrop: PhotoCrop = {
  width: '134.43%',
  height: '150.16%',
  left: '-19.29%',
  top: '-9.75%',
};

type Result = { faceType: FaceType; brow: BrowShape | null; photo: string };

// The photo's local URI is passed to ⑭ only to show it; it stays on the device.
function openResult(result: Result) {
  router.push({
    pathname: '/diagnosis',
    params: {
      face: result.faceType,
      photo: result.photo,
      ...(result.brow ? { brow: result.brow } : {}),
    },
  });
}

async function takePhoto() {
  const permission = await requestCameraPermissionsAsync();
  if (!permission.granted) {
    return { error: 'カメラを使う許可がありません。設定から許可してください' };
  }
  return await launchCameraAsync({ mediaTypes: 'images', cameraType: CameraType.front });
}

async function diagnosePhoto(uri: string): Promise<Result | { message: string }> {
  try {
    const landmarks = await FaceTracker?.detectFaceAsync(uri);
    const diagnosis = landmarks ? diagnoseFace(landmarks) : undefined;
    if (!diagnosis) {
      return { message: '顔が見つかりませんでした。顔全体が写った写真で試してください' };
    }
    if (diagnosis.kind === 'notFrontal') {
      return { message: '正面を向いた写真で試してください' };
    }
    return { faceType: diagnosis.faceType, brow: diagnosis.brow, photo: uri };
  } catch {
    return { message: '写真を読み込めませんでした。別の写真で試してください' };
  }
}

// Plan A ⑬ 写真からメイク提案. The photo is read on device by MediaPipe Face Landmarker and is
// never sent anywhere. The last result is kept only while the app runs.
export function Suggest() {
  const insets = useSafeAreaInsets();
  // The suggest tab stays mounted under other tabs; only claim the status bar while it is shown.
  const focused = useIsFocused();
  // The tab's bottom safe-area inset includes the tab bar on both platforms.
  const bottom = insets.bottom;
  const rose = useTokenColor('--color-accent-rose');
  const [photo, setPhoto] = useState<string>();
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState<string>();
  const [last, setLast] = useState<Result>();

  async function diagnose(source: 'camera' | 'library') {
    if (analyzing) {
      return;
    }
    setMessage(undefined);
    try {
      const picked =
        source === 'camera'
          ? await takePhoto()
          : await launchImageLibraryAsync({ mediaTypes: 'images' });
      if ('error' in picked) {
        setMessage(picked.error);
        return;
      }
      const uri = picked.assets?.[0]?.uri;
      if (picked.canceled || !uri) {
        return;
      }
      setPhoto(uri);
      setAnalyzing(true);
      const outcome = await diagnosePhoto(uri);
      if ('message' in outcome) {
        setMessage(outcome.message);
      } else {
        setLast(outcome);
        openResult(outcome);
      }
    } catch {
      setMessage('写真を用意できませんでした。もう一度お試しください');
    } finally {
      setAnalyzing(false);
    }
  }

  const unavailable = FaceTracker ? undefined : '写真からの診断は開発ビルドで使えます';
  const note = unavailable ?? message;
  return (
    <View className="flex-1 bg-white" style={{ paddingBottom: bottom + 48 }}>
      {focused ? <StatusBar style="dark" /> : null}
      <Hero photo={photo} />
      <View className="absolute inset-x-0 top-0 items-center">
        <View
          // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- This half point is part of the header gradient geometry.
          className="w-full items-center px-4 pb-[24.5px]"
          style={{
            paddingTop: insets.top + 7.5,
            backgroundImage:
              'linear-gradient(to bottom, #ffffff 0%, rgba(255,255,255,0.94) 66%, rgba(255,255,255,0) 100%)',
          }}
        >
          <Text
            accessibilityRole="header"
            className="text-center font-maru-bold text-headline text-ink-primary"
          >
            似合うメイクを見つける
          </Text>
        </View>
        {analyzing ? (
          <View accessible accessibilityLiveRegion="polite">
            <Tag>
              <SocialIcon name={SCAN} size={14} color={rose} />
              <Text className="font-maru-bold text-label text-accent-rose">
                顔の形を見ています…
              </Text>
            </Tag>
          </View>
        ) : null}
      </View>
      {note ? (
        <View className="mx-4 -mt-16 mb-10 rounded-2xl bg-white/90 px-4 py-2.5">
          <Text
            accessibilityRole={unavailable ? undefined : 'alert'}
            className="text-center font-maru text-label text-ink-primary"
          >
            {note}
          </Text>
        </View>
      ) : null}
      <Controls
        unavailable={Boolean(unavailable)}
        busy={analyzing}
        onDiagnose={(source) => {
          void diagnose(source);
        }}
        onLast={
          last
            ? () => {
                openResult(last);
              }
            : undefined
        }
      />
    </View>
  );
}

// Plan A's control row: 写真から, カメラで診断 and 前回の診断.
function Controls({
  unavailable,
  busy,
  onDiagnose,
  onLast,
}: {
  unavailable: boolean;
  busy: boolean;
  onDiagnose: (source: 'camera' | 'library') => void;
  onLast: (() => void) | undefined;
}) {
  const ink = useTokenColor('--color-ink-primary');
  const surface = useTokenColor('--color-bg-surface');
  const enabled = !unavailable && !busy;
  const suffix = unavailable ? '（開発ビルドで使えます）' : '';
  return (
    <View className="-mt-6 flex-row justify-center">
      <Action
        label="写真から"
        accessibilityLabel={`写真から診断${suffix}`}
        onPress={
          enabled
            ? () => {
                onDiagnose('library');
              }
            : undefined
        }
      >
        <View className="size-13 items-center justify-center rounded-full border border-black bg-bg-surface">
          <SocialIcon name={PHOTO} size={24} color={ink} />
        </View>
      </Action>
      <Action
        label="カメラで診断"
        accessibilityLabel={`カメラで診断${suffix}`}
        onPress={
          enabled
            ? () => {
                onDiagnose('camera');
              }
            : undefined
        }
      >
        <View
          className="size-21 items-center justify-center rounded-full bg-bg-surface"
          style={{ boxShadow: '0px 8px 24px rgba(196, 61, 112, 0.14)' }}
        >
          <View className="size-17 items-center justify-center rounded-full bg-accent-rose">
            <SocialIcon name={CAMERA} size={28} color={surface} />
          </View>
        </View>
      </Action>
      <Action
        label="前回の診断"
        accessibilityLabel={onLast ? '前回の診断' : '前回の診断（まだありません）'}
        onPress={onLast}
      >
        <View className="size-13 items-center justify-center rounded-full border border-black bg-bg-surface">
          <SocialIcon name={HISTORY} size={24} color={ink} />
        </View>
      </Action>
    </View>
  );
}

// The hero fills the space above the controls; the Plan A frame is scaled to cover it so
// the face guide stays on the face at every screen size.
function Hero({ photo }: { photo: string | undefined }) {
  const [size, setSize] = useState<{ width: number; height: number }>();
  const scale = size ? Math.max(size.width / frame.width, size.height / frame.height) : 0;
  const width = frame.width * scale;
  const height = frame.height * scale;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={photo ? '診断する写真' : '顔の形を見る見本の写真'}
      className="flex-1 overflow-hidden rounded-b-camera-preview"
      onLayout={(event) => {
        const { width: layoutWidth, height: layoutHeight } = event.nativeEvent.layout;
        setSize({ width: layoutWidth, height: layoutHeight });
      }}
    >
      {photo ? (
        <Image
          accessible={false}
          source={{ uri: photo }}
          contentFit="cover"
          style={{ width: '100%', height: '100%' }}
        />
      ) : size ? (
        <View
          pointerEvents="none"
          className="absolute"
          style={{
            width,
            height,
            left: (size.width - width) / 2,
            top: (size.height - height) / 2,
          }}
        >
          <CroppedPhoto source={arPhotos.camera} crop={heroCrop} />
          <View
            // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- The overlay height follows the Plan A photo crop.
            className="absolute inset-x-0 h-[4.84%]"
            style={{
              top: '54.5%',
              backgroundImage:
                'linear-gradient(to bottom, rgba(255,168,196,0) 0%, rgba(255,168,196,0.25) 85%, rgba(255,255,255,0.95) 100%)',
            }}
          />
          <Image
            accessible={false}
            source={faceGuide}
            contentFit="fill"
            style={{ position: 'absolute', width: '100%', height: '100%' }}
          />
          <View className="absolute" style={{ left: '82.56%', top: '48.63%' }}>
            <Tag className="px-3">
              <Text className="font-maru-bold text-micro text-ink-primary">中顔面</Text>
            </Tag>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Tag({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <View
      className={cn(
        'flex-row items-center gap-1.25 rounded-2xl border border-white bg-white/78 py-1.5 pl-2 pr-3',
        className,
      )}
      style={{ boxShadow: '0px 3px 5px rgba(196, 61, 112, 0.12)' }}
    >
      {children}
    </View>
  );
}

// One column of the Plan A control row: the button and its label share one touch target.
// Without onPress the control is shown as in Plan A but disabled until it is built.
function Action({
  label,
  accessibilityLabel = label,
  onPress,
  children,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress?: (() => void) | undefined;
  children: ReactNode;
}) {
  const disabled = !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="w-26.75 items-center justify-end gap-1.5 active:opacity-70"
    >
      {children}
      <Text className="text-center font-maru-bold text-label text-ink-primary">{label}</Text>
    </Pressable>
  );
}
