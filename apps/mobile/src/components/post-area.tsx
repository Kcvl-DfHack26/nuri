import type { LayoutChangeEvent } from 'react-native';

import { Canvas } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { PostStep } from '@/components/post-draft';
import type { Point } from '@/lib/face-landmarks';

import { FaceTexture } from '@/components/face-texture';
import { usePostDraft } from '@/components/post-draft';
import { partColors } from '@/components/recipes';
import { useShapeTexture } from '@/components/shape-texture';
import { Text } from '@/components/ui/text';
import {
  changeWidth,
  fitView,
  hasLines,
  movePoint,
  pointStep,
  shapeHandles,
  textureToFace,
} from '@/lib/area-edit';
import { canonicalVertexCount } from '@/lib/face-mesh';
import { defaultShape } from '@/lib/region-shape';
import { cn } from '@/lib/utils';

import FaceTracker from '../../modules/face-tracker/src/FaceTrackerModule';

/** The step's frame and the face found in it, normalized to the frame. */
type FrameFace =
  | { status: 'unavailable' | 'noFrame' | 'loading' | 'noFace' }
  | { status: 'ready'; points: readonly number[]; width: number; height: number };

// The preview shows the area like a thumbnail, both sides of a paired part included; editing zooms
// in on the points of one side. Parts painted over much of the face are zoomed in less.
const views = {
  preview: { margin: 0.9, maxZoom: 2, wideMaxZoom: 1.3 },
  edit: { margin: 0.6, maxZoom: 4, wideMaxZoom: 1.8 },
} as const;
const wideParts = new Set<PostStep['part']>(['base', 'shading', 'highlight', 'cheek']);

/** Finds the face in the step's frame on the device; Expo Go has no face tracker. */
function useFrameFace(image: string | null): FrameFace {
  const [found, setFound] = useState<{ image: string; face: FrameFace } | null>(null);
  useEffect(() => {
    if (!FaceTracker || !image) {
      return;
    }
    let active = true;
    FaceTracker.detectFaceAsync(image).then(
      (face) => {
        if (active) {
          setFound({
            image,
            face: face ? { status: 'ready', ...face } : { status: 'noFace' },
          });
        }
      },
      () => {
        if (active) {
          setFound({ image, face: { status: 'noFace' } });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [image]);
  if (!FaceTracker) {
    return { status: 'unavailable' };
  }
  if (!image) {
    return { status: 'noFrame' };
  }
  return found?.image === image ? found.face : { status: 'loading' };
}

const messages: Record<Exclude<FrameFace['status'], 'ready'>, string> = {
  unavailable: 'この環境では塗る範囲を表示できません',
  noFrame: '手順の場面がないため、塗る範囲を表示できません',
  loading: '塗る範囲を準備しています',
  noFace: '手順の場面から顔を見つけられなかったため、塗る範囲を表示できません',
};

/**
 * ⑫-5 (#196): the area read from the video, painted on the face in the step's frame like a
 * thumbnail. 編集する zooms in on one side's points: tapping one, or 前の点・次の点, picks it;
 * 上・下・左・右 move that point a little, and a paired part's other side follows as its mirror.
 * 太く・細く change the lines, and 範囲を消す drops the area. The step keeps the changed area. A
 * step without an area starts from the part's plain one with 範囲を追加.
 */
export function AreaEditor({ step, position }: { step: PostStep; position: number }) {
  const { updateStep } = usePostDraft();
  const face = useFrameFace(step.image);
  const shape = step.shape;
  const texture = useShapeTexture(shape);
  const [box, setBox] = useState(0);
  const [picked, setPicked] = useState(0);
  const [editing, setEditing] = useState(false);
  const handles = shape ? shapeHandles(shape) : [];
  const pickedIndex = Math.max(0, Math.min(picked, handles.length - 1));
  const selected = handles[pickedIndex];
  const color = step.cosmetics[0]?.color ?? partColors[step.part];

  const header = (
    <View className="gap-0.5">
      <Text accessibilityRole="header" className="font-maru-bold text-label text-ink-primary">
        塗る範囲
      </Text>
      <Text className="font-maru text-meta text-ink-secondary">
        見る人の顔に合わせて重ねて表示されます
      </Text>
    </View>
  );
  if (!shape) {
    // A step the analysis found no area for, or one the user added, starts from a plain area.
    const plain = defaultShape(step.part);
    return (
      <View className="gap-2">
        {header}
        <Text className="font-maru text-meta text-ink-secondary">
          この手順には塗る範囲がありません
        </Text>
        {plain ? (
          <EditButton
            label="範囲を追加"
            onPress={() => {
              updateStep(position, { shape: plain });
              setPicked(0);
              setEditing(true);
            }}
          />
        ) : null}
      </View>
    );
  }
  if (face.status !== 'ready' || !step.image) {
    return (
      <View className="gap-2">
        {header}
        <Text accessibilityLiveRegion="polite" className="font-maru text-meta text-ink-secondary">
          {messages[face.status === 'ready' ? 'noFrame' : face.status]}
        </Text>
      </View>
    );
  }

  // The frame fills a square box; the zoom fits the area's points with a margin around them.
  const aspect = face.width / face.height;
  const base = { width: box, height: box / aspect };
  const facePoints: Point[] = [];
  for (let index = 0; index < canonicalVertexCount; index += 1) {
    facePoints.push({
      x: (face.points[index * 2] ?? 0) * base.width,
      y: (face.points[index * 2 + 1] ?? 0) * base.height,
    });
  }
  const placed = handles.map((handle) => textureToFace(handle.uv, facePoints));
  // The preview also fits the mirrored copies, so both brows or both eyes show.
  const mirrored = editing
    ? []
    : handles.flatMap((handle) =>
        shape.strokes[handle.stroke]?.mirror
          ? [textureToFace({ x: 1 - handle.uv.x, y: handle.uv.y }, facePoints)]
          : [],
      );
  const painted = [...placed, ...mirrored];
  const view = views[editing ? 'edit' : 'preview'];
  // A shape with nothing painted falls back to the whole face.
  const { zoom, offset } = fitView(painted.length > 0 ? painted : facePoints, box, {
    margin: view.margin,
    maxZoom: wideParts.has(step.part) ? view.wideMaxZoom : view.maxZoom,
  });
  const toBox = (point: Point) => ({ x: point.x * zoom + offset.x, y: point.y * zoom + offset.y });
  const zoomedFace = facePoints.map(toBox);

  const move = (dx: number, dy: number) => {
    if (selected) {
      updateStep(position, { shape: movePoint(shape, selected, dx, dy) });
    }
  };

  return (
    <View className="gap-2">
      {header}
      <View
        onLayout={(event: LayoutChangeEvent) => {
          setBox(event.nativeEvent.layout.width);
        }}
        testID="塗る範囲の場面"
        className="aspect-square w-full overflow-hidden rounded-panel bg-ink-primary"
      >
        {box > 0 ? (
          <>
            <Image
              accessible={false}
              source={{ uri: step.image }}
              contentFit="fill"
              style={{
                position: 'absolute',
                left: offset.x,
                top: offset.y,
                width: base.width * zoom,
                height: base.height * zoom,
              }}
            />
            {texture ? (
              <Canvas
                pointerEvents="none"
                style={{ position: 'absolute', width: box, height: box }}
              >
                <FaceTexture points={zoomedFace} texture={texture} color={color} opacity={0.85} />
              </Canvas>
            ) : null}
            {(editing ? placed : []).map((point, index) => {
              const at = toBox(point);
              const isPicked = index === pickedIndex;
              return (
                <Pressable
                  key={`${handles[index]?.stroke}-${handles[index]?.point}`}
                  accessibilityRole="button"
                  accessibilityLabel={`点${index + 1}`}
                  accessibilityState={{ selected: isPicked }}
                  hitSlop={10}
                  onPress={() => {
                    setPicked(index);
                  }}
                  className="absolute size-7 items-center justify-center"
                  style={{ left: at.x - 14, top: at.y - 14 }}
                >
                  <View
                    className={cn(
                      'rounded-full border-2 border-white',
                      isPicked ? 'size-4.5 bg-accent-rose' : 'size-3 bg-white/70',
                    )}
                  />
                </Pressable>
              );
            })}
          </>
        ) : null}
      </View>
      {editing ? (
        <>
          <Text className="font-maru text-meta text-ink-secondary">
            点をタッチして選び、ボタンで動かします
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <EditButton
              label="前の点"
              onPress={() => {
                setPicked((pickedIndex - 1 + handles.length) % handles.length);
              }}
            />
            <EditButton
              label="次の点"
              onPress={() => {
                setPicked((pickedIndex + 1) % handles.length);
              }}
            />
          </View>
          <View className="flex-row flex-wrap gap-2">
            <EditButton
              label="上へ"
              onPress={() => {
                move(0, -pointStep);
              }}
            />
            <EditButton
              label="下へ"
              onPress={() => {
                move(0, pointStep);
              }}
            />
            <EditButton
              label="左へ"
              onPress={() => {
                move(-pointStep, 0);
              }}
            />
            <EditButton
              label="右へ"
              onPress={() => {
                move(pointStep, 0);
              }}
            />
          </View>
          <View className="flex-row flex-wrap gap-2">
            {hasLines(shape) ? (
              <>
                <EditButton
                  label="太く"
                  onPress={() => {
                    updateStep(position, { shape: changeWidth(shape, true) });
                  }}
                />
                <EditButton
                  label="細く"
                  onPress={() => {
                    updateStep(position, { shape: changeWidth(shape, false) });
                  }}
                />
              </>
            ) : null}
            <EditButton
              label="範囲を消す"
              onPress={() => {
                updateStep(position, { shape: null });
              }}
            />
          </View>
          <EditButton
            label="完了"
            onPress={() => {
              setEditing(false);
            }}
          />
        </>
      ) : (
        <EditButton
          label="編集する"
          onPress={() => {
            setEditing(true);
          }}
        />
      )}
    </View>
  );
}

function EditButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-12 min-w-16 items-center justify-center rounded-full border border-ink-primary px-4 active:opacity-70"
    >
      <Text className="font-maru-bold text-label text-ink-primary">{label}</Text>
    </Pressable>
  );
}
