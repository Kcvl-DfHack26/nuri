import type { ReactNode } from 'react';

import { Canvas, useImage } from '@shopify/react-native-skia';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  AppState,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import type { PartId } from '@/components/recipes';
import type { Point, Size } from '@/lib/face-landmarks';
import type { MakeupLayer } from '@/lib/face-makeup';

import { ArMetricsOverlay, arMetricsEnabled } from '@/components/ar-metrics';
import { FaceTexture } from '@/components/face-texture';
import { useShapeTexture } from '@/components/shape-texture';
import { Text } from '@/components/ui/text';
import { recordArRender, recordArResult, startArMetricsWindow } from '@/lib/ar-metrics';
import { toViewPoints } from '@/lib/face-landmarks';
import { canonicalVertexCount } from '@/lib/face-mesh';

import type { FaceTrackerStatusEvent } from '../../modules/face-tracker/src/FaceTracker.types';

import baseTexture from '../../assets/textures/base.png';
import browTexture from '../../assets/textures/brow.png';
import cheekTexture from '../../assets/textures/cheek.png';
import eyeTexture from '../../assets/textures/eye.png';
import highlightTexture from '../../assets/textures/highlight.png';
import lashTexture from '../../assets/textures/lash.png';
import lipTexture from '../../assets/textures/lip.png';
import shadingTexture from '../../assets/textures/shading.png';
import FaceTracker from '../../modules/face-tracker/src/FaceTrackerModule';
import FaceTrackerView from '../../modules/face-tracker/src/FaceTrackerView';

/** Whether this build has the face tracker; Expo Go does not. */
export const canTrackFace = Boolean(FaceTracker);

/** A pin and its label on the face, at the part's landmark. */
export type FaceAnnotation = { part: PartId; label: string };

// How strongly each part's texture is painted. Base and highlight are sheer; the brows stay partly
// transparent so bangs over them show through until hair is cut out of the overlay.
const opacity: Record<PartId, number> = {
  base: 0.35,
  brow: 0.7,
  eye: 0.8,
  lash: 0.9,
  cheek: 0.8,
  shading: 0.8,
  highlight: 0.6,
  lip: 0.85,
};

const standardTextures: Record<PartId, number> = {
  base: baseTexture,
  brow: browTexture,
  eye: eyeTexture,
  lash: lashTexture,
  cheek: cheekTexture,
  shading: shadingTexture,
  highlight: highlightTexture,
  lip: lipTexture,
};

// A MediaPipe landmark inside each part's painted area, for the annotation pin.
const anchors: Record<PartId, number> = {
  base: 151,
  brow: 105,
  eye: 27,
  lash: 33,
  cheek: 50,
  shading: 234,
  highlight: 6,
  lip: 17,
};

/**
 * The front camera with the given makeup layers painted on the tracked face, all on device: the
 * camera frames and landmarks never leave it. Shows guidance when the camera is not allowed or no
 * face is found. Only use it when `canTrackFace` is true.
 */
export function FaceMakeupCamera({
  layers,
  annotation,
  children,
}: {
  /** One layer per part, in paint order. */
  layers: readonly MakeupLayer[];
  annotation?: FaceAnnotation | undefined;
  /** Drawn over the camera, under the guidance. */
  children?: ReactNode;
}) {
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(
    () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  );
  const [permission, setPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [status, setStatus] = useState<FaceTrackerStatusEvent>();
  const [view, setView] = useState<Size>({ width: 0, height: 0 });
  const [points, setPoints] = useState<Point[]>([]);
  // Created once and changed in place, so measuring never re-renders the camera.
  const [metrics] = useState(() => startArMetricsWindow(performance.now()));
  const active = permission === 'granted' && focused && appActive;
  // Nothing to place on the face (⑩, or ⑦ with the guide hidden): stop the inference.
  const tracksFace = layers.length > 0 || annotation !== undefined;

  // Passive effects run after the commit, so this marks when the latest landmarks were rendered.
  useEffect(() => {
    if (arMetricsEnabled) {
      recordArRender(metrics, performance.now());
    }
  }, [metrics, points]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Drop the last frame's landmarks when the camera pauses, so a stale overlay never shows.
  useEffect(() => {
    if (active) {
      return () => {
        setStatus(undefined);
        setPoints([]);
      };
    }
  }, [active]);

  // Landmarks from before tracking stopped must not reappear when it resumes. The status is kept:
  // native reports only changes, so it still tells whether a face was found when tracking resumes.
  useEffect(() => {
    if (tracksFace) {
      return () => {
        setPoints([]);
      };
    }
  }, [tracksFace]);

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

  const cameraDenied = permission === 'denied' || status?.status === 'permissionDenied';
  const tracking = active && tracksFace && status?.status === 'tracking' && points.length > 0;
  const meshReady = tracking && points.length === canonicalVertexCount;
  const message = cameraDenied
    ? 'カメラを使う許可がありません'
    : tracksFace && status?.status === 'noFace'
      ? '顔をカメラに向けてください'
      : status?.status === 'error'
        ? (status.message ?? '顔追跡を始められませんでした')
        : undefined;
  const pin = annotation ? points[anchors[annotation.part]] : undefined;

  return (
    <View
      className="absolute inset-0 bg-black"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width !== view.width || height !== view.height) {
          setView({ width, height });
          setPoints([]);
        }
      }}
    >
      <FaceTrackerView
        active={active}
        trackLandmarks={tracksFace}
        style={StyleSheet.absoluteFill}
        onLandmarks={(event) => {
          // A result may still arrive just after tracking stops.
          if (!active || !tracksFace) {
            return;
          }
          // A fresh result proves tracking resumed even if native skips a repeated status.
          if (status?.status !== 'tracking') {
            setStatus({ status: 'tracking' });
          }
          const frame = event.nativeEvent;
          if (arMetricsEnabled) {
            recordArResult(metrics, {
              latencyMs: frame.latencyMs,
              nowMs: performance.now(),
            });
          }
          setPoints(toViewPoints(frame.points, frame, view, canonicalVertexCount));
        }}
        onStatus={(event) => {
          if (!active) {
            return;
          }
          setStatus(event.nativeEvent);
          if (event.nativeEvent.status !== 'tracking') {
            setPoints([]);
          }
        }}
      />
      {/* The layers stay mounted while the face is lost, so their textures are not made again when
          it returns; they draw nothing until the mesh is ready. */}
      {layers.length > 0 ? (
        <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
          {layers.map((layer) => (
            <LayerTexture key={layer.part} layer={layer} points={meshReady ? points : undefined} />
          ))}
        </Canvas>
      ) : null}
      {tracking && annotation && pin ? (
        <Pin point={pin} label={annotation.label} view={view} />
      ) : null}
      {children}
      {arMetricsEnabled ? <ArMetricsOverlay metrics={metrics} /> : null}
      {message ? (
        <View className="absolute inset-x-8 top-1/2 items-center gap-3">
          <Text
            accessibilityLiveRegion="polite"
            className="rounded-2xl bg-black/60 px-4 py-2 text-center font-maru-bold text-label text-white"
          >
            {message}
          </Text>
          {cameraDenied ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void Linking.openSettings();
              }}
              className="min-h-12 items-center justify-center rounded-full bg-white px-6 active:opacity-70"
            >
              <Text className="font-maru-bold text-label text-ink-primary">設定を開く</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// One layer on the face: its step's shape when it has one, otherwise the part's standard texture.
// The standard texture is loaded only when it is used, since each is 1024×1024. Draws nothing
// without points.
function LayerTexture({ layer, points }: { layer: MakeupLayer; points: Point[] | undefined }) {
  const shapeTexture = useShapeTexture(layer.shape);
  const standardTexture = useImage(shapeTexture ? null : standardTextures[layer.part]);
  const texture = shapeTexture ?? standardTexture;
  if (!texture || !points) {
    return null;
  }
  return (
    <FaceTexture
      points={points}
      texture={texture}
      color={layer.color}
      opacity={opacity[layer.part]}
    />
  );
}

// Plan A's pin and label, moved with the landmark. The label sits on the side away from the face's
// middle so it does not cover the painted area.
function Pin({ point, label, view }: { point: Point; label: string; view: Size }) {
  const onLeft = point.x < view.width / 2;
  return (
    <View pointerEvents="none" className="absolute inset-0">
      <View
        className="absolute size-5.5 items-center justify-center rounded-full bg-white/95"
        style={{
          left: point.x - 11,
          top: point.y - 11,
          boxShadow: '0px 2px 6px rgba(196, 61, 112, 0.25)',
        }}
      >
        <View className="size-2.5 rounded-full bg-accent-rose" />
      </View>
      <View
        className="absolute rounded-thumbnail border border-white bg-white/80 px-2.5 py-0.75"
        style={{
          top: point.y - 13,
          ...(onLeft ? { right: view.width - point.x + 16 } : { left: point.x + 16 }),
          boxShadow: '0px 3px 5px rgba(196, 61, 112, 0.12)',
        }}
      >
        <Text className="font-maru-bold text-micro text-ink-primary">{label}</Text>
      </View>
    </View>
  );
}
