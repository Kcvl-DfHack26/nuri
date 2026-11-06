import type { ReactNode } from 'react';

import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PhotoCrop } from '@/components/recipes';

import { CroppedPhoto } from '@/components/cropped-photo';
import { arPhotos } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { useTokenColor } from '@/theme/tokens';

import faceGuide from '../../assets/plan-a/suggest/face-guide.svg';

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

// Plan A ⑬ 写真からメイク提案. Camera, photo picking and diagnosis are not built yet:
// the hero shows a fixed sample photo and 前回の診断 opens the fixed sample result (⑭).
export function Suggest() {
  const insets = useSafeAreaInsets();
  // The suggest tab stays mounted under other tabs; only claim the status bar while it is shown.
  const focused = useIsFocused();
  // On iOS the tab's safe area includes the tab bar; Android tabs already pad their content.
  const bottom = Platform.OS === 'ios' ? insets.bottom : 0;
  const ink = useTokenColor('--color-ink-primary');
  const rose = useTokenColor('--color-accent-rose');
  const surface = useTokenColor('--color-bg-surface');
  return (
    <View className="flex-1 bg-white" style={{ paddingBottom: bottom + 48 }}>
      {focused ? <StatusBar style="dark" /> : null}
      <Hero />
      <View className="absolute inset-x-0 top-0 items-center">
        <View
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
        <Tag>
          <SocialIcon name={SCAN} size={14} color={rose} />
          <Text className="font-maru-bold text-label text-accent-rose">顔の形を見ています…</Text>
        </Tag>
      </View>
      <View className="-mt-6 flex-row justify-center">
        <Action label="写真から" accessibilityLabel="写真から診断（準備中）">
          <View className="size-[52px] items-center justify-center rounded-full border border-black bg-bg-surface">
            <SocialIcon name={PHOTO} size={24} color={ink} />
          </View>
        </Action>
        <Action label="カメラで診断" accessibilityLabel="カメラで診断（準備中）">
          <View
            className="size-[84px] items-center justify-center rounded-full bg-bg-surface"
            style={{ boxShadow: '0px 8px 24px rgba(196, 61, 112, 0.14)' }}
          >
            <View className="size-[68px] items-center justify-center rounded-full bg-accent-rose">
              <SocialIcon name={CAMERA} size={28} color={surface} />
            </View>
          </View>
        </Action>
        <Action
          label="前回の診断"
          onPress={() => {
            router.push('/diagnosis');
          }}
        >
          <View className="size-[52px] items-center justify-center rounded-full border border-black bg-bg-surface">
            <SocialIcon name={HISTORY} size={24} color={ink} />
          </View>
        </Action>
      </View>
    </View>
  );
}

// The hero fills the space above the controls; the Plan A frame is scaled to cover it so
// the face guide stays on the face at every screen size.
function Hero() {
  const [size, setSize] = useState<{ width: number; height: number }>();
  const scale = size ? Math.max(size.width / frame.width, size.height / frame.height) : 0;
  const width = frame.width * scale;
  const height = frame.height * scale;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="顔の形を見る見本の写真"
      className="flex-1 overflow-hidden rounded-b-[36px]"
      onLayout={(event) => {
        const { width: layoutWidth, height: layoutHeight } = event.nativeEvent.layout;
        setSize({ width: layoutWidth, height: layoutHeight });
      }}
    >
      {size ? (
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
        'flex-row items-center gap-[5px] rounded-2xl border border-white bg-white/78 py-1.5 pl-2 pr-3',
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
  onPress?: () => void;
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
      className="w-[107px] items-center justify-end gap-1.5 active:opacity-70"
    >
      {children}
      <Text className="text-center font-maru-bold text-label text-ink-primary">{label}</Text>
    </Pressable>
  );
}
