import { Image } from 'expo-image';

import type { PhotoCrop } from '@/components/recipes';

// Reproduces a Figma image fill: the photo is scaled and offset inside a clipping parent.
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
    <Image
      accessible={false}
      source={source}
      contentFit="fill"
      style={{ position: 'absolute', opacity, ...crop }}
    />
  );
}
