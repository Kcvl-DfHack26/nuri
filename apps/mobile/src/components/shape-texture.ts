import type { SkImage } from '@shopify/react-native-skia';
import type { MakeupShape } from '@starter/shared';

import {
  BlendMode,
  BlurStyle,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
} from '@shopify/react-native-skia';
import { makeupShapeSchema } from '@starter/shared';
import { useMemo } from 'react';

import { shapeStrokes } from '@/lib/makeup-shape';

// Half the standard textures' 1024px: the shapes are soft, and this keeps drawing quick.
const size = 512;

/**
 * A step's shape drawn on device into a white, transparent texture laid out like MediaPipe's
 * canonical face texture, for FaceTexture to color and map onto the face. The shape comes from the
 * API's JSON, so it is validated here; null when the step has no shape or an invalid one, so the
 * part's standard texture is used.
 */
export function useShapeTexture(shape: MakeupShape | null | undefined): SkImage | null {
  return useMemo(() => {
    const parsed = makeupShapeSchema.safeParse(shape);
    if (!parsed.success) {
      return null;
    }
    const surface = Skia.Surface.Make(size, size);
    if (!surface) {
      return null;
    }
    const canvas = surface.getCanvas();
    for (const stroke of shapeStrokes(parsed.data, size)) {
      const [first, ...rest] = stroke.points;
      if (!first) {
        continue;
      }
      const builder = Skia.PathBuilder.Make();
      builder.moveTo(first.x, first.y);
      for (const point of rest) {
        builder.lineTo(point.x, point.y);
      }
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setColor(Skia.Color('white'));
      paint.setAlphaf(stroke.opacity);
      if (stroke.erase) {
        paint.setBlendMode(BlendMode.DstOut);
      }
      if (stroke.closed) {
        builder.close();
        paint.setStyle(PaintStyle.Fill);
      } else {
        paint.setStyle(PaintStyle.Stroke);
        paint.setStrokeWidth(stroke.width);
        paint.setStrokeCap(StrokeCap.Round);
        paint.setStrokeJoin(StrokeJoin.Round);
      }
      if (stroke.blur > 0) {
        paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, stroke.blur, true));
      }
      canvas.drawPath(builder.build(), paint);
    }
    surface.flush();
    return surface.makeImageSnapshot();
  }, [shape]);
}
