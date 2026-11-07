import { Icon } from '@expo/ui';
import { Canvas, Points, useImage } from '@shopify/react-native-skia';
import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Point, Size } from '@/lib/face-landmarks';

import { FaceTexture } from '@/components/face-texture';
import { GlassIconButton } from '@/components/glass-icon-button';
import { Text } from '@/components/ui/text';
import { toViewPoints } from '@/lib/face-landmarks';
import { canonicalFaceMesh } from '@/lib/face-mesh';
import { backOrHome } from '@/lib/navigation';
import { useTokenColor } from '@/theme/tokens';

import type {
  FaceLandmarksEvent,
  FaceTrackerStatusEvent,
} from '../../modules/face-tracker/src/FaceTracker.types';

import browTexture from '../../assets/textures/brow.png';
import FaceTracker from '../../modules/face-tracker/src/FaceTrackerModule';
import FaceTrackerView from '../../modules/face-tracker/src/FaceTrackerView';

const BACK = Icon.select({
  ios: 'chevron.left',
  android: import('@expo/material-symbols/arrow_back_ios_new.xml'),
});

// The sample recipe's brow color (`foxSteps` in recipes.ts). The overlay stays partly transparent so
// bangs over the brows show through until hair is cut out of it (requirements 11).
const BROW_COLOR = '#79513A';
const BROW_OPACITY = 0.7;

type Stats = { fps: number; latencyMs: number; maxLatencyMs: number; count: number };

// Development check for #25 (PoC-1) and #26: the front camera with the brow texture of the canonical
// face mesh and the iris landmarks drawn over it, plus the measured frame rate and delay. It is
// replaced by ⑦ once the AR steps use the tracker.
export function FaceTrackingCheck() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const rose = useTokenColor('--color-accent-rose');
  const brow = useImage(browTexture);
  const [permission, setPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [status, setStatus] = useState<FaceTrackerStatusEvent>();
  const [view, setView] = useState<Size>({ width: 0, height: 0 });
  const [points, setPoints] = useState<Point[]>([]);
  const [stats, setStats] = useState<Stats>();
  // Arrival times and delays of the last second of results.
  const samples = useRef<{ at: number; latencyMs: number }[]>([]);

  useEffect(() => {
    if (!FaceTracker) {
      return;
    }
    let mounted = true;
    FaceTracker.requestCameraPermissionAsync()
      .then((granted) => {
        if (mounted) {
          setPermission(granted ? 'granted' : 'denied');
        }
      })
      .catch(() => {
        if (mounted) {
          setPermission('denied');
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Android keeps the app running when the camera is allowed in the system settings, so check again
  // on return without prompting. iOS restarts the app after a permission change and asks on mount.
  useEffect(() => {
    if (!FaceTracker || Platform.OS !== 'android' || permission !== 'denied') {
      return;
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        return;
      }
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA)
        .then((granted) => {
          if (granted) {
            setPermission('granted');
          }
        })
        .catch(() => {
          setPermission('denied');
        });
    });
    return () => {
      subscription.remove();
    };
  }, [permission]);

  function handleLandmarks(event: FaceLandmarksEvent) {
    const now = performance.now();
    const recent = samples.current.filter((sample) => now - sample.at < 1000);
    recent.push({ at: now, latencyMs: event.latencyMs });
    samples.current = recent;
    const delays = recent.map((sample) => sample.latencyMs).filter((value) => value >= 0);
    setStats({
      fps: recent.length,
      latencyMs: delays.length ? delays.reduce((sum, value) => sum + value, 0) / delays.length : -1,
      maxLatencyMs: delays.length ? Math.max(...delays) : -1,
      count: event.points.length / 2,
    });
    setPoints(toViewPoints(event.points, event, view));
  }

  const cameraDenied = permission === 'denied' || status?.status === 'permissionDenied';
  const message = guidanceMessage(status, cameraDenied);
  const tracking = status?.status === 'tracking';

  return (
    <View
      className="flex-1 bg-black"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setView({ width, height });
      }}
    >
      <StatusBar style="light" />
      {FaceTracker ? (
        <FaceTrackerView
          active={permission === 'granted' && focused}
          style={StyleSheet.absoluteFill}
          onLandmarks={(event) => {
            handleLandmarks(event.nativeEvent);
          }}
          onStatus={(event) => {
            setStatus(event.nativeEvent);
          }}
        />
      ) : null}
      {tracking ? (
        <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
          {brow ? (
            <FaceTexture points={points} texture={brow} color={BROW_COLOR} opacity={BROW_OPACITY} />
          ) : null}
          {/* MediaPipe's landmarks after the mesh's 468 vertices are the two irises. */}
          <Points
            points={points.slice(canonicalFaceMesh.textureCoordinates.length)}
            mode="points"
            color={rose}
            strokeWidth={4}
            strokeCap="round"
          />
        </Canvas>
      ) : null}
      <View
        className="absolute inset-x-4 min-h-11 flex-row items-center gap-2"
        style={{ top: insets.top + 8 }}
      >
        <GlassIconButton
          icon={BACK}
          label="戻る"
          onPress={() => {
            backOrHome();
          }}
        />
        <Text
          accessibilityRole="header"
          className="flex-1 text-center font-maru-bold text-heading text-white"
        >
          顔追跡の確認
        </Text>
        <View className="size-10" />
      </View>
      <View
        className="absolute inset-x-4 gap-2 rounded-2xl bg-black/60 p-4"
        style={{ bottom: Math.max(insets.bottom, 12) + 8 }}
      >
        {message ? (
          <Text accessibilityLiveRegion="polite" className="font-maru-bold text-label text-white">
            {message}
          </Text>
        ) : null}
        {cameraDenied ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void Linking.openSettings();
            }}
            className="min-h-12 items-center justify-center rounded-full bg-white active:opacity-70"
          >
            <Text className="font-maru-bold text-label text-ink-primary">設定を開く</Text>
          </Pressable>
        ) : null}
        {stats && tracking ? (
          <Text className="font-maru text-meta text-white">
            {`${stats.fps} fps・遅延 平均${Math.round(stats.latencyMs)}ms 最大${Math.round(
              stats.maxLatencyMs,
            )}ms・特徴点 ${stats.count}点`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function guidanceMessage(status: FaceTrackerStatusEvent | undefined, cameraDenied: boolean) {
  if (!FaceTracker) {
    return 'この画面は開発ビルドで開いてください。Expo Goでは顔追跡を使えません';
  }
  if (cameraDenied) {
    return 'カメラを使う許可がありません';
  }
  if (status?.status === 'noFace') {
    return '顔をカメラに向けてください';
  }
  if (status?.status === 'error') {
    return status.message ?? '顔追跡を始められませんでした';
  }
  return undefined;
}
