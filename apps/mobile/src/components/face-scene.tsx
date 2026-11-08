import type { ReactNode } from 'react';

import { View } from 'react-native';

import type { PhotoCrop } from '@/components/recipes';

import { CroppedPhoto } from '@/components/cropped-photo';
import { useLayoutSize } from '@/lib/layout';

// Plan A draws the camera screens on a 390×844 frame. Scale that frame to cover the
// measured preview so the photo and the overlays drawn for it stay aligned on every aspect ratio.
const frame = { width: 390, height: 844 };
const cameraCrop: PhotoCrop = {
  width: '135.21%',
  height: '110.95%',
  left: '-19.69%',
  top: '-6.24%',
};

export function FaceScene({ photo, children }: { photo: number; children?: ReactNode }) {
  const { width, height, onLayout } = useLayoutSize();
  const scale = Math.max(width / frame.width, height / frame.height);
  const photoWidth = frame.width * scale;
  const photoHeight = frame.height * scale;

  return (
    <View pointerEvents="none" className="absolute inset-0 overflow-hidden" onLayout={onLayout}>
      {scale > 0 ? (
        <View
          className="absolute overflow-hidden"
          style={{
            width: photoWidth,
            height: photoHeight,
            left: (width - photoWidth) / 2,
            top: (height - photoHeight) / 2,
          }}
        >
          <CroppedPhoto source={photo} crop={cameraCrop} />
          {children}
        </View>
      ) : null}
    </View>
  );
}
