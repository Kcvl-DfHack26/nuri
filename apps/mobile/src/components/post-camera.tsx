import type { ReactNode } from 'react';

import { Icon } from '@expo/ui';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { launchImageLibraryAsync, UIImagePickerControllerQualityType } from 'expo-image-picker';
import { router, useIsFocused, useNavigation, usePreventRemove } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassIconButton } from '@/components/glass-icon-button';
import { MediaLayout } from '@/components/media-layout';
import { usePostDraft } from '@/components/post-draft';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { authClient } from '@/lib/api';
import { backOrHome } from '@/lib/navigation';
import { formatElapsed, spokenElapsed } from '@/lib/recording';
import { useTokenColor } from '@/theme/tokens';

import drafts from '../../assets/plan-a/post/drafts.png';

const IMAGE = Icon.select({ ios: 'photo', android: import('@expo/material-symbols/image.xml') });
const CLOSE = Icon.select({ ios: 'xmark', android: import('@expo/material-symbols/close.xml') });

// The system picker hands over only the chosen video, so no photo library permission is asked.
async function pickVideo() {
  // iOS exports the chosen video at a medium size so it fits the analysis API's limit (#151).
  const result = await launchImageLibraryAsync({
    mediaTypes: 'videos',
    videoQuality: UIImagePickerControllerQualityType.Medium,
  });
  const video = result.assets?.[0];
  if (result.canceled || !video) {
    return;
  }
  // The URI stays on the device in the post's data. Consent is asked on ⑫-3, right before the
  // video is sent for analysis (#81).
  router.push({
    pathname: '/post/creating',
    params: video.duration
      ? { video: video.uri, duration: String(video.duration) }
      : { video: video.uri },
  });
}

/**
 * Asks for the camera and the microphone together the first time ⑫-1 is shown, and rereads them
 * when the app returns from the Settings app.
 */
function useRecordingAccess(enabled: boolean) {
  const [camera, requestCamera, getCamera] = useCameraPermissions();
  const [microphone, requestMicrophone, getMicrophone] = useMicrophonePermissions();
  const asked = useRef(false);
  const request = async () => {
    if (camera && !camera.granted && camera.canAskAgain) {
      await requestCamera();
    }
    if (microphone && !microphone.granted && microphone.canAskAgain) {
      await requestMicrophone();
    }
  };
  useEffect(() => {
    if (!enabled || !camera || !microphone || asked.current) {
      return;
    }
    asked.current = true;
    void request();
  });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void getCamera();
        void getMicrophone();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [getCamera, getMicrophone]);
  const granted = Boolean(camera?.granted && microphone?.granted);
  // A denial the OS will not ask about again can only be changed in the Settings app.
  const askable = (permission: typeof camera) =>
    permission ? !permission.granted && permission.canAskAgain : false;
  const canAsk = askable(camera) || askable(microphone);
  return {
    loaded: Boolean(camera && microphone),
    granted,
    retry: () => {
      if (canAsk) {
        void request();
      } else {
        void Linking.openSettings();
      }
    },
    retryLabel: canAsk ? '許可する' : '設定を開く',
  };
}

// Plan A ⑫-1 動画を撮る. The front camera is shown only while the tab is in front, and nothing
// leaves the device here.
export function PostCamera() {
  const insets = useSafeAreaInsets();
  // The post tab stays mounted under other tabs; only claim the status bar while it is shown.
  const focused = useIsFocused();
  const { data: session } = authClient.useSession();
  // Guests log in before recording, so only a signed-in user is asked for the camera.
  const access = useRecordingAccess(focused && Boolean(session));
  const ink = useTokenColor('--color-ink-primary');
  // Posting belongs to an account, so guests log in before recording or choosing a video (#42).
  const signedIn = (start: () => void) => () => {
    if (session) {
      start();
    } else {
      router.push('/account');
    }
  };
  // Android's camera is shared by the whole app, and a camera view that closes releases it for every
  // view. So ⑫-1 closes its camera before ⑫-2 opens one, and opens it again on return.
  const [opening, setOpening] = useState(false);
  const [wasFocused, setWasFocused] = useState(focused);
  if (focused !== wasFocused) {
    setWasFocused(focused);
    if (focused) {
      setOpening(false);
    }
  }
  useEffect(() => {
    if (opening) {
      router.push('/post/recording');
    }
  }, [opening]);
  // Tab content lies under the tab bar, which both platforms report as the bottom safe-area inset.
  const bottom = insets.bottom + 24;
  return (
    <View className="flex-1 bg-white">
      {focused ? <StatusBar style="dark" /> : null}
      <View className="flex-1 overflow-hidden rounded-b-camera-preview bg-bg-surface">
        {focused && access.granted && !opening ? (
          <CameraView facing="front" mode="video" style={StyleSheet.absoluteFill} />
        ) : null}
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
        {access.loaded && !access.granted ? (
          <View className="flex-1 items-center justify-center gap-4 px-8">
            <Text className="text-center font-maru text-label text-ink-primary">
              動画を撮るには、カメラとマイクの許可が必要です
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={access.retry}
              className="min-h-12 items-center justify-center rounded-full bg-white px-6 active:opacity-70"
            >
              <Text className="font-maru-bold text-label text-ink-primary">
                {access.retryLabel}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <View
        className="-mt-6 flex-row items-end justify-center gap-2.75 px-4"
        style={{ paddingBottom: bottom }}
      >
        <CameraAction
          label="動画から"
          onPress={signedIn(() => {
            void pickVideo();
          })}
        >
          <View className="size-13 items-center justify-center rounded-full border border-ink-primary bg-bg-surface">
            <SocialIcon name={IMAGE} size={24} color={ink} />
          </View>
        </CameraAction>
        <CameraAction
          label="録画をはじめる"
          onPress={signedIn(() => {
            if (!access.granted) {
              access.retry();
              return;
            }
            setOpening(true);
          })}
        >
          <View
            className="size-21 items-center justify-center rounded-full bg-bg-surface"
            style={{ boxShadow: '0px 8px 24px rgba(196, 61, 112, 0.14)' }}
          >
            <View className="size-17 rounded-full bg-accent-rose" />
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
  onPress?: (() => void) | undefined;
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
      className="w-24 shrink items-center gap-1.5 active:opacity-70"
    >
      {children}
      <Text className="text-center font-maru-bold text-label text-ink-primary">{label}</Text>
    </Pressable>
  );
}

/** How a recording ends: kept for ⑫-3, or deleted from the device. */
type Ending = { kind: 'finish'; durationMs: number } | { kind: 'discard' };

// Plan A ⑫-2 録画中. Recording starts once the camera is ready. 撮影を終える keeps the video in the
// post's data; closing or leaving deletes the video, so nothing is sent. Plan A's 手順を区切る and
// its step bar are left out (#186): Gemini finds the steps, and ⑫-4/⑫-5 add and move them.
export function PostRecording() {
  const insets = useSafeAreaInsets();
  const { setDraft } = usePostDraft();
  const camera = useRef<CameraView>(null);
  const ending = useRef<Ending | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Leaving ⑫-2 in any way (closing, Android's back, finishing) first closes this camera, so ⑫-1's
  // camera is never released by this one closing after it opened (see PostCamera).
  const navigation = useNavigation();
  const [released, setReleased] = useState(false);
  const leave = useRef<(() => void) | null>(null);
  // The recording in progress settles once it is stopped, after its file is kept or deleted.
  const recording = useRef<Promise<void> | null>(null);
  usePreventRemove(!released, ({ data }) => {
    ending.current ??= { kind: 'discard' };
    camera.current?.stopRecording();
    // Unmounting the camera first could reject the recording before its file is deleted.
    void (recording.current ?? Promise.resolve()).finally(() => {
      leave.current = () => {
        navigation.dispatch(data.action);
      };
      setReleased(true);
    });
  });
  useEffect(() => {
    if (released) {
      leave.current?.();
      leave.current = null;
    }
  }, [released]);
  useEffect(() => {
    if (startedAt === null) {
      return;
    }
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => {
      clearInterval(timer);
    };
  }, [startedAt]);
  const elapsed = startedAt === null ? 0 : Math.max(now - startedAt, 0);

  const stopUnexpectedly = (title: string) => {
    ending.current = { kind: 'discard' };
    Alert.alert(title, 'もう一度お試しください。');
    backOrHome();
  };

  const start = () => {
    if (startedAt !== null || !camera.current) {
      return;
    }
    setStartedAt(Date.now());
    setNow(Date.now());
    recording.current = camera.current
      // avc1 lets iOS apply videoBitrate; H.264 is also what Gemini reads most widely.
      .recordAsync({ codec: 'avc1' })
      .then((result) => {
        const end = ending.current;
        if (!result) {
          return;
        }
        if (end?.kind === 'finish') {
          setDraft((current) => ({
            ...current,
            video: { uri: result.uri, marks: [], durationMs: end.durationMs },
          }));
          router.replace('/post/creating');
          return;
        }
        new File(result.uri).delete();
        if (!end) {
          // The OS ended it, e.g. when the app went to the background.
          stopUnexpectedly('録画が中断されました');
        }
      })
      .catch(() => {
        // Closing ⑫-2 may stop the recording with an error; there is nothing to report then.
        if (ending.current?.kind !== 'discard') {
          stopUnexpectedly('録画できませんでした');
        }
      });
  };

  return (
    <MediaLayout
      media={
        <>
          {released ? null : (
            <CameraView
              ref={camera}
              facing="front"
              mode="video"
              // About 7.5 MB a minute, so recordings of up to about 4 minutes fit the analysis
              // API's 30 MB limit (#151). Gemini looks at about one frame a second.
              videoQuality="720p"
              videoBitrate={1_000_000}
              style={StyleSheet.absoluteFill}
              onCameraReady={start}
              onMountError={() => {
                stopUnexpectedly('カメラを開けませんでした');
              }}
            />
          )}
          <View
            pointerEvents="none"
            className="absolute inset-x-0 top-0"
            style={{
              height: insets.top + 86,
              backgroundImage:
                'linear-gradient(to bottom, rgba(255,255,255,0.8), rgba(255,255,255,0))',
            }}
          />
        </>
      }
      header={
        <View style={{ paddingTop: insets.top + 8 }}>
          <View className="relative">
            <View className="absolute left-4 top-0">
              <GlassIconButton
                icon={CLOSE}
                label="閉じる"
                onPress={() => {
                  ending.current = { kind: 'discard' };
                  camera.current?.stopRecording();
                  backOrHome();
                }}
              />
            </View>
            <View pointerEvents="none" className="items-center gap-2 px-14">
              <View className="flex-row items-center gap-2 rounded-panel bg-bg-surface py-2 pl-3 pr-3.5">
                <View className="size-2.5 rounded-full bg-accent-rose" />
                <Text
                  accessibilityLabel={`録画時間 ${spokenElapsed(elapsed)}`}
                  className="font-maru-bold text-action text-ink-primary"
                >
                  {formatElapsed(elapsed)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      }
      footer={
        <View
          className="gap-3.5 rounded-t-sheet bg-post-panel px-5 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <View className="flex-row items-center justify-between">
            <CameraAction label="一時停止">
              <View className="size-13 flex-row items-center justify-center gap-1.25 rounded-full border border-ink-primary">
                <View className="h-4.5 w-1.25 rounded-sm bg-ink-primary" />
                <View className="h-4.5 w-1.25 rounded-sm bg-ink-primary" />
              </View>
            </CameraAction>
            <CameraAction
              label="撮影を終える"
              onPress={
                startedAt === null
                  ? undefined
                  : () => {
                      ending.current = { kind: 'finish', durationMs: Date.now() - startedAt };
                      camera.current?.stopRecording();
                    }
              }
            >
              <View className="size-18 items-center justify-center rounded-full bg-bg-surface">
                <View className="size-6.5 rounded-md bg-accent-rose" />
              </View>
            </CameraAction>
            {/* Keeps 撮影を終える in the middle now that 手順を区切る is gone. */}
            <View className="w-24 shrink" />
          </View>
        </View>
      }
    />
  );
}
