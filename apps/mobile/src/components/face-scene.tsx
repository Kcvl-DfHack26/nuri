import type { ReactNode } from 'react';

import { useWindowDimensions, View } from 'react-native';

import type { PhotoCrop } from '@/components/recipes';

import { CroppedPhoto } from '@/components/cropped-photo';

// Plan A draws the camera screens on a 390×844 frame. Scale that frame to cover the
// window so the photo and the overlays drawn for it stay aligned on every aspect ratio.
const frame = { width: 390, height: 844 };
const cameraCrop: PhotoCrop = {
  width: '135.21%',
  height: '110.95%',
  left: '-19.69%',
  top: '-6.24%',
};

export function FaceScene({ photo, children }: { photo: number; children?: ReactNode }) {
  const window = useWindowDimensions();
  const scale = Math.max(window.width / frame.width, window.height / frame.height);
  const width = frame.width * scale;
  const height = frame.height * scale;
  return (
    <View
      pointerEvents="none"
      className="absolute overflow-hidden"
      style={{
        width,
        height,
        left: (window.width - width) / 2,
        top: (window.height - height) / 2,
      }}
    >
      <CroppedPhoto source={photo} crop={cameraCrop} />
      {children}
    </View>
  );
}
