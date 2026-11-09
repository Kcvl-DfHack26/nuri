import type { MakeupShape } from '@starter/shared';
import type { LayoutChangeEvent } from 'react-native';

import { Canvas } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';

import type { Point } from '@/lib/face-landmarks';

import { FaceTexture } from '@/components/face-texture';
import { arPhotos } from '@/components/recipes';
import { useShapeTexture } from '@/components/shape-texture';
import { Text } from '@/components/ui/text';
import { canonicalVertexCount } from '@/lib/face-mesh';
import { sampleFaceLandmarks, sampleFaceSize } from '@/lib/sample-face';

/** A step's area and the color it is painted in. */
export type SummaryArea = { shape: MakeupShape; color: string };

// The square shown around the sample face, as a share of the face's size.
const cropScale = 1.3;

/** The sample photo's square crop around the face, in photo pixels. */
function faceCrop() {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let index = 0; index < canonicalVertexCount; index += 1) {
    xs.push((sampleFaceLandmarks[index * 2] ?? 0) * sampleFaceSize.width);
    ys.push((sampleFaceLandmarks[index * 2 + 1] ?? 0) * sampleFaceSize.height);
  }
  const side =
    Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * cropScale;
  return {
    left: (Math.min(...xs) + Math.max(...xs)) / 2 - side / 2,
    top: (Math.min(...ys) + Math.max(...ys)) / 2 - side / 2,
    side,
  };
}
const crop = faceCrop();

/**
 * ⑫-8 (#202): every step's area painted on Plan A's sample face, so the whole look can be checked
 * before posting without the user's own face. Nothing shows when no step has an area.
 */
export function AreaSummary({ areas }: { areas: SummaryArea[] }) {
  const [box, setBox] = useState(0);
  if (areas.length === 0) {
    return null;
  }
  const scale = box / crop.side;
  const face: Point[] = [];
  for (let index = 0; index < canonicalVertexCount; index += 1) {
    face.push({
      x: ((sampleFaceLandmarks[index * 2] ?? 0) * sampleFaceSize.width - crop.left) * scale,
      y: ((sampleFaceLandmarks[index * 2 + 1] ?? 0) * sampleFaceSize.height - crop.top) * scale,
    });
  }
  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="font-maru-bold text-heading text-ink-primary">
        塗る範囲
      </Text>
      <View
        accessible
        accessibilityLabel={`見本の顔に${areas.length}つの手順の塗る範囲を重ねた図`}
        onLayout={(event: LayoutChangeEvent) => {
          setBox(event.nativeEvent.layout.width);
        }}
        className="aspect-square w-full overflow-hidden rounded-panel bg-bg-base"
      >
        {box > 0 ? (
          <>
            <Image
              accessible={false}
              source={arPhotos.camera}
              contentFit="fill"
              style={{
                position: 'absolute',
                left: -crop.left * scale,
                top: -crop.top * scale,
                width: sampleFaceSize.width * scale,
                height: sampleFaceSize.height * scale,
              }}
            />
            <Canvas pointerEvents="none" style={{ position: 'absolute', width: box, height: box }}>
              {areas.map((area, index) => (
                <AreaLayer key={index} area={area} face={face} />
              ))}
            </Canvas>
          </>
        ) : null}
      </View>
      <Text className="font-maru text-meta text-ink-secondary">
        見本の顔に、すべての手順の塗る範囲を重ねています
      </Text>
    </View>
  );
}

function AreaLayer({ area, face }: { area: SummaryArea; face: Point[] }) {
  const texture = useShapeTexture(area.shape);
  return texture ? (
    <FaceTexture points={face} texture={texture} color={area.color} opacity={0.7} />
  ) : null;
}
