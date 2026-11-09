import type { Cheek, MakeupShape } from '@starter/shared';

import type { Point } from './face-landmarks';

import { canonicalFaceMesh } from './face-mesh';

// Blush by type (#224): Gemini picks one of these instead of landmarks, because blush is a soft
// area. Each is an ellipse, or the triangle below, on the right cheek (the texture's left) in the
// canonical texture, mirrored to the left, placed after the samples' 透明感の韓国風 (round) and
// 狐メイク (diagonal).
// `angle` tilts the long axis so its outer end rises (degrees).
const ellipses: Record<
  Exclude<Cheek['style'], 'triangle'>,
  { center: Point; rx: number; ry: number; angle: number }
> = {
  // Every type but low starts just under the eye, as high as underEye, and the large size still
  // stays clear of the lower lid (#224: lower ones read as too low on the face).
  // Round, below the pupil.
  round: { center: { x: 0.262, y: 0.4784 }, rx: 0.068, ry: 0.062, angle: 0 },
  // Along the top of the cheekbone.
  high: { center: { x: 0.235, y: 0.4603 }, rx: 0.085, ry: 0.042, angle: 10 },
  // From the cheekbone up toward the temple.
  diagonal: { center: { x: 0.222, y: 0.4799 }, rx: 0.095, ry: 0.04, angle: 35 },
  // Level with the nose wing, the one type kept low.
  low: { center: { x: 0.255, y: 0.565 }, rx: 0.08, ry: 0.045, angle: 0 },
  // Wide just under the eye, clear of the lower lid.
  underEye: { center: { x: 0.29, y: 0.455 }, rx: 0.095, ry: 0.038, angle: 5 },
};
// 三角ゾーン: below the pupil, out toward the temple, and down toward the nose wing. The edge
// midpoints keep the sides straight when the outline is smoothed; only the corners round off.
const triangle: readonly Point[] = [
  { x: 0.322, y: 0.4496 },
  { x: 0.246, y: 0.4336 },
  { x: 0.17, y: 0.4186 },
  { x: 0.219, y: 0.4876 },
  { x: 0.268, y: 0.5556 },
  { x: 0.295, y: 0.5026 },
];
// Blush is blended out past where the brush first lands, so the sizes run a little above the
// types' base size, and each grows down and outward from a fixed top edge, never toward the eye
// (#224).
const scales: Record<Cheek['size'], number> = { small: 0.9, medium: 1.1, large: 1.3 };
const pointCount = 12;

// The 468 landmarks of the canonical mesh; the irises are not in it.
const uv = canonicalFaceMesh.textureCoordinates.slice(0, 468);
const round4 = (value: number) => Math.round(value * 10000) / 10000;

/** A point held by its nearest landmark, so the blush follows each face like the samples do. */
function anchored(point: Point) {
  let at = 0;
  let best = Infinity;
  uv.forEach((landmark, index) => {
    const distance = Math.hypot(landmark.x - point.x, landmark.y - point.y);
    if (distance < best) {
      best = distance;
      at = index;
    }
  });
  const base = uv[at] ?? { x: 0, y: 0 };
  const dx = round4(point.x - base.x);
  const dy = round4(point.y - base.y);
  return { at, ...(dx ? { dx } : {}), ...(dy ? { dy } : {}) };
}

/** Blush for a cheek step without a type: an answer from before #224, or one added on ⑫-5. */
export const plainCheek: Cheek = { style: 'round', size: 'medium' };

/** The outline of a type at a scale, around its middle, in the canonical texture. */
function outline(style: Cheek['style'], scale: number): Point[] {
  if (style === 'triangle') {
    const middle = {
      x: triangle.reduce((sum, p) => sum + p.x, 0) / triangle.length,
      y: triangle.reduce((sum, p) => sum + p.y, 0) / triangle.length,
    };
    return triangle.map((p) => ({
      x: middle.x + (p.x - middle.x) * scale,
      y: middle.y + (p.y - middle.y) * scale,
    }));
  }
  const { center, rx, ry, angle } = ellipses[style];
  // The outer end (smaller u on the right cheek) rises: the axis runs from inner-low to outer-high.
  const theta = (angle * Math.PI) / 180;
  return Array.from({ length: pointCount }, (_, index) => {
    const t = (index / pointCount) * Math.PI * 2;
    const x = Math.cos(t) * rx * scale;
    const y = Math.sin(t) * ry * scale;
    return {
      x: center.x + x * Math.cos(theta) - y * Math.sin(theta),
      y: center.y + x * Math.sin(theta) + y * Math.cos(theta),
    };
  });
}

const top = (points: readonly Point[]) => Math.min(...points.map((point) => point.y));

/** The blush of a cheek step: a soft area of its type and size on both cheeks. */
export function cheekShape({ style, size }: Cheek): MakeupShape {
  const grown = outline(style, scales[size]);
  // The top edge stays where the type puts it; a larger size reaches further down instead.
  const down = top(outline(style, 1)) - top(grown);
  const points = grown.map((point) => anchored({ x: point.x, y: point.y + down }));
  return { strokes: [{ points, fill: true, mirror: true, blur: 0.03, opacity: 0.75 }] };
}
