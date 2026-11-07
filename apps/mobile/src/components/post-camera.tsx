import type { ReactNode } from 'react';

import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FaceScene } from '@/components/face-scene';
import { GlassIconButton } from '@/components/glass-icon-button';
import { arPhotos } from '@/components/recipes';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { authClient } from '@/lib/api';
import { backOrHome } from '@/lib/navigation';
import { useTokenColor } from '@/theme/tokens';

import drafts from '../../assets/plan-a/post/drafts.png';

const IMAGE = Icon.select({ ios: 'photo', android: import('@expo/material-symbols/image.xml') });
const CLOSE = Icon.select({ ios: 'xmark', android: import('@expo/material-symbols/close.xml') });
const MIC = Icon.select({ ios: 'mic', android: import('@expo/material-symbols/mic.xml') });
const ADD = Icon.select({ ios: 'plus', android: import('@expo/material-symbols/add.xml') });

// The system picker hands over only the chosen video, so no photo library permission is asked.
async function pickVideo() {
  const result = await launchImageLibraryAsync({ mediaTypes: 'videos' });
  const video = result.assets?.[0];
  if (result.canceled || !video) {
    return;
  }
  // The URI stays on the device in the post's data. Consent is asked where a video is first
  // sent, which is not built yet (#81).
  router.push({ pathname: '/post/creating', params: { video: video.uri } });
}

// Plan A ⑫-1 動画を撮る. The camera is not built; Plan A's still frame stands in and no
// image leaves the device.
export function PostCamera() {
  const insets = useSafeAreaInsets();
  // The post tab stays mounted under other tabs; only claim the status bar while it is shown.
  const focused = useIsFocused();
  const { data: session } = authClient.useSession();
  const ink = useTokenColor('--color-ink-primary');
  // Posting belongs to an account, so guests log in before recording or choosing a video (#42).
  const signedIn = (start: () => void) => () => {
    if (session) {
      start();
    } else {
      router.push('/account');
    }
  };
  // iOS lays tab content under the tab bar and reports it as a safe-area inset; Android already
  // places the content above the tab bar.
  const bottom = (Platform.OS === 'ios' ? insets.bottom : 0) + 24;
  return (
    <View className="flex-1 bg-white">
      {focused ? <StatusBar style="dark" /> : null}
      <View className="flex-1 overflow-hidden rounded-b-[36px]">
        <FaceScene photo={arPhotos.camera} />
        <View
          pointerEvents="none"
          className="absolute inset-x-0 top-0"
          style={{
            height: insets.top + 116,
            backgroundImage:
              'linear-gradient(to bottom, #ffffff 0%, rgba(255,255,255,0.94) 66%, rgba(255,255,255,0) 100%)',
          }}
        />
        <View className="items-center gap-1 px-4" style={{ paddingTop: insets.top + 10 }}>
          <Text
            accessibilityRole="header"
            className="text-center font-maru-bold text-headline text-ink-primary"
          >
            メイク動画を撮る
          </Text>
          <Text className="text-center font-maru text-meta text-ink-secondary">
            撮った動画から、手順書を自動で作ります
          </Text>
          <View className="mt-5 rounded-2xl bg-bg-surface px-3 py-1.5">
            <Text className="font-maru text-meta text-ink-primary">
              顔が画面に入る位置に置いてください
            </Text>
          </View>
        </View>
      </View>
      <View
        className="-mt-6 flex-row items-end justify-center gap-[11px] px-4"
        style={{ paddingBottom: bottom }}
      >
        <CameraAction
          label="動画から"
          onPress={signedIn(() => {
            void pickVideo();
          })}
        >
          <View className="size-[52px] items-center justify-center rounded-full border border-ink-primary bg-bg-surface">
            <SocialIcon name={IMAGE} size={24} color={ink} />
          </View>
        </CameraAction>
        <CameraAction
          label="録画をはじめる"
          onPress={signedIn(() => {
            router.push('/post/recording');
          })}
        >
          <View
            className="size-[84px] items-center justify-center rounded-full bg-bg-surface"
            style={{ boxShadow: '0px 8px 24px rgba(196, 61, 112, 0.14)' }}
          >
            <View className="size-[68px] rounded-full bg-accent-rose" />
          </View>
        </CameraAction>
        <CameraAction label="下書き">
          <Image accessible={false} source={drafts} style={{ width: 52, height: 52 }} />
        </CameraAction>
      </View>
    </View>
  );
}

function CameraAction({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress?: () => void;
  children: ReactNode;
}) {
  const disabled = !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={disabled ? `${label}（準備中）` : label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="w-24 items-center gap-1.5 active:opacity-70"
    >
      {children}
      <Text className="text-center font-maru-bold text-label text-ink-primary">{label}</Text>
    </Pressable>
  );
}

// Plan A ⑫-2 録画中. The timer, step and segments show Plan A's sample; nothing records.
export function PostRecording() {
  const insets = useSafeAreaInsets();
  const secondary = useTokenColor('--color-ink-secondary');
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <FaceScene photo={arPhotos.camera} />
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0"
        style={{
          height: insets.top + 86,
          backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.8), rgba(255,255,255,0))',
        }}
      />
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
        pointerEvents="none"
        className="absolute inset-x-20 items-center gap-2"
        style={{ top: insets.top + 12 }}
      >
        <View className="flex-row items-center gap-2 rounded-[20px] bg-bg-surface py-2 pl-3 pr-3.5">
          <View className="size-2.5 rounded-full bg-accent-rose" />
          <Text
            accessibilityLabel="録画時間 3分24秒"
            className="font-maru-bold text-action text-ink-primary"
          >
            03:24
          </Text>
        </View>
        <View className="rounded-2xl bg-bg-surface px-3 py-1.5">
          <Text className="font-maru text-meta text-ink-primary">手順3 を撮影中</Text>
        </View>
      </View>
      <View
        className="absolute inset-x-0 bottom-0 gap-3.5 rounded-t-[28px] bg-[rgba(241,241,241,0.85)] px-5 pt-4"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <View className="h-2 flex-row gap-[3px]" accessible={false}>
          <View className="flex-[56] rounded bg-accent-rose" />
          <View className="flex-[92] rounded bg-accent-rose" />
          <View className="flex-[46] rounded bg-accent-rose/45" />
          <View className="flex-[147] rounded bg-ink-primary/15" />
        </View>
        <View className="flex-row items-center gap-1.5">
          <SocialIcon name={MIC} size={16} color={secondary} />
          <Text className="flex-1 font-maru text-meta text-ink-secondary">
            「次」と言っても区切れます
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <CameraAction label="一時停止">
            <View className="size-[52px] flex-row items-center justify-center gap-[5px] rounded-full border border-ink-primary">
              <View className="h-[18px] w-[5px] rounded-sm bg-ink-primary" />
              <View className="h-[18px] w-[5px] rounded-sm bg-ink-primary" />
            </View>
          </CameraAction>
          <CameraAction
            label="撮影を終える"
            onPress={() => {
              router.replace('/post/creating');
            }}
          >
            <View className="size-[72px] items-center justify-center rounded-full bg-bg-surface">
              <View className="size-[26px] rounded-md bg-accent-rose" />
            </View>
          </CameraAction>
          <CameraAction label="手順を区切る">
            <View className="size-[52px] items-center justify-center rounded-full bg-accent-rose">
              <SocialIcon name={ADD} size={26} color="white" />
            </View>
          </CameraAction>
        </View>
      </View>
    </View>
  );
}
