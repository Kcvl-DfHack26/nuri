import { Image } from 'expo-image';
import { View } from 'react-native';

import type { PhotoCrop } from '@/components/recipes';

// Reproduces a Figma image fill: the photo is scaled and offset inside a clipping parent.
// The full-size wrapper makes the percentages relative to the whole frame, not the
// parent's padded content box.
export function CroppedPhoto({
  source,
  crop,
  opacity = 1,
}: {
  source: number;
  crop: PhotoCrop;
  opacity?: number;
}) {
  return (
    <View pointerEvents="none" className="absolute inset-0">
      <Image
        accessible={false}
        source={source}
        contentFit="fill"
        style={{ position: 'absolute', opacity, ...crop }}
      />
    </View>
  );
}
