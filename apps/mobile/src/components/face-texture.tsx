import type { SkImage } from '@shopify/react-native-skia';

import { BlendColor, ImageShader, Vertices } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { Point } from '@/lib/face-landmarks';

import { canonicalFaceMesh } from '@/lib/face-mesh';

type FaceTextureProps = {
  /** The mesh's 468 vertices in view coordinates, in MediaPipe's order. */
  points: Point[];
  /** A transparent image painted in the canonical face mesh's texture space. */
  texture: SkImage;
  /** The finish color the texture is multiplied by. */
  color: string;
  opacity: number;
};

/**
 * Draws a texture painted for MediaPipe's canonical face mesh over the tracked face, inside a Skia
 * Canvas. Each triangle's vertices move with the landmarks while their texture coordinates stay
 * fixed, so the painted area follows the face.
 */
export function FaceTexture({ points, texture, color, opacity }: FaceTextureProps) {
  const textureWidth = texture.width();
  const textureHeight = texture.height();
  // Vertices take texture coordinates in the image shader's pixels.
  const texturePixels = useMemo(
    () =>
      canonicalFaceMesh.textureCoordinates.map(({ x, y }) => ({
        x: x * textureWidth,
        y: y * textureHeight,
      })),
    [textureWidth, textureHeight],
  );
  return (
    <Vertices
      vertices={points}
      textures={texturePixels}
      indices={canonicalFaceMesh.triangles}
      opacity={opacity}
    >
      <ImageShader image={texture} />
      {/* Modulate multiplies each texel by the color. Skia's Multiply mode would also paint the
          color where the texture is transparent. */}
      <BlendColor color={color} mode="modulate" />
    </Vertices>
  );
}
