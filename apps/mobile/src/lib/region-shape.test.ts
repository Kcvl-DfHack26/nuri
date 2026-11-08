import type { PostAnalysis } from '@starter/shared';

import { makeupShapeSchema } from '@starter/shared';

import { canonicalFaceMesh } from './face-mesh';
import { shapeStrokes } from './makeup-shape';
import { defaultShape, regionShape } from './region-shape';

type Region = PostAnalysis['steps'][number]['regions'][number];

const uv = canonicalFaceMesh.textureCoordinates;
const region = (fields: Partial<Region>): Region => ({
  detail: '',
  side: 'both',
  start: 'browHead',
  end: 'browTail',
  shape: 'line',
  length: 'none',
  direction: 'none',
  clip: 'none',
  ...fields,
});

test('the canonical UV has the subject’s right on its left half', () => {
  expect(uv[33]?.x).toBeLessThan(0.5);
  expect(uv[263]?.x).toBeGreaterThan(0.5);
});

test('draws a brow on both sides as one mirrored line along the brow', () => {
  const shape = regionShape([region({ detail: '眉頭から眉尻まで' })]);
  expect(makeupShapeSchema.safeParse(shape).success).toBe(true);
  expect(shape?.strokes).toHaveLength(1);
  const [stroke] = shape?.strokes ?? [];
  expect(stroke?.mirror).toBe(true);
  expect(stroke?.points.length).toBeGreaterThanOrEqual(4);
  expect(stroke?.width).toBeGreaterThan(0);
});

test('extends the brow tails outward on both sides even when one side was seen', () => {
  const tail = region({
    side: 'screenLeft',
    start: 'browTail',
    end: 'none',
    length: 'long',
    direction: 'outward',
  });
  const shape = regionShape([tail]);
  expect(makeupShapeSchema.safeParse(shape).success).toBe(true);
  expect(shape?.strokes[0]?.mirror).toBe(true);
  const [right, left] = shapeStrokes(shape ?? { strokes: [] }, 1);
  // The subject's right brow is drawn past its tail toward the texture's left edge, and mirrored.
  expect(Math.min(...(right?.points ?? []).map((point) => point.x))).toBeLessThan(uv[46]?.x ?? 0);
  expect(Math.max(...(left?.points ?? []).map((point) => point.x))).toBeGreaterThan(
    uv[276]?.x ?? 1,
  );
  // The same area seen on the right of the video is not drawn twice.
  expect(regionShape([tail, { ...tail, side: 'screenRight' }])).toEqual(shape);
});

test('lines the upper lid with a wing and never paints inside the eye', () => {
  const shape = regionShape([
    region({
      detail: '上まぶたのきわ',
      start: 'eyeInner',
      end: 'eyeOuter',
      length: 'short',
      direction: 'upOutward',
    }),
  ]);
  expect(makeupShapeSchema.safeParse(shape).success).toBe(true);
  const strokes = shape?.strokes ?? [];
  expect(strokes).toHaveLength(2);
  // The wing starts past the outer corner, then the line follows the lid's landmarks.
  expect(strokes[0]?.points[0]?.at).toBe(33);
  expect(strokes[0]?.points[0]?.dy).toBeLessThan(0);
  expect(strokes[0]?.points.slice(1).map((point) => point.at)).toContain(159);
  expect(strokes.at(-1)).toMatchObject({ fill: true, erase: true, mirror: true });
});

test('fills both lips and cuts out the open mouth', () => {
  const shape = regionShape([
    region({ side: 'center', start: 'lips', end: 'none', shape: 'area' }),
  ]);
  expect(makeupShapeSchema.safeParse(shape).success).toBe(true);
  expect(shape?.strokes.map((stroke) => [stroke.fill, stroke.erase ?? false])).toEqual([
    [true, false],
    [true, false],
    [true, true],
  ]);
});

test('puts blush as an ellipse on the cheek', () => {
  const shape = regionShape([
    region({
      start: 'cheekCenter',
      end: 'none',
      shape: 'ellipse',
      length: 'medium',
      direction: 'upOutward',
    }),
  ]);
  expect(makeupShapeSchema.safeParse(shape).success).toBe(true);
  expect(shape?.strokes[0]).toMatchObject({ fill: true, mirror: true });
  expect(shape?.strokes[0]?.points).toHaveLength(12);
});

test('keeps blush toward the temple on the cheekbone, below the eye', () => {
  const shape = regionShape([
    region({ start: 'cheekboneTop', end: 'temple', shape: 'ellipse', direction: 'upOutward' }),
  ]);
  expect(makeupShapeSchema.safeParse(shape).success).toBe(true);
  const [blush] = shapeStrokes(shape ?? { strokes: [] }, 1);
  const points = blush?.points ?? [];
  const middle = points.reduce((sum, point) => sum + point.y, 0) / Math.max(points.length, 1);
  // Centered on the cheekbone, not moved halfway to the temple.
  expect(middle).toBeCloseTo(uv[117]?.y ?? 0, 2);
  expect(Math.min(...points.map((point) => point.x))).toBeGreaterThan(0);
});

test('mirrors by the landmarks, not by the side Gemini named', () => {
  // A nose shadow from the nose root to the brow head runs on both sides.
  const shadow = regionShape([region({ side: 'center', start: 'noseRoot', end: 'browHead' })]);
  expect(shadow?.strokes[0]?.mirror).toBe(true);
  // A highlight along the nose bridge stays on the midline.
  const highlight = regionShape([
    region({ side: 'screenLeft', start: 'noseBridge', end: 'noseTip' }),
  ]);
  expect(highlight?.strokes[0]?.mirror).toBeUndefined();
});

test('keeps at most 8 strokes with the cut-outs last, and returns null for nothing', () => {
  const starts = ['noseWing', 'mouthCorner', 'temple', 'jawAngle', 'cheekCenter', 'chin'] as const;
  const many = [
    region({ start: 'eyeOuter', end: 'eyeInner', detail: '上まぶた' }),
    region({ start: 'browHead', end: 'browTail' }),
    ...starts.map((start) => region({ start, end: 'none', length: 'medium' })),
  ];
  const shape = regionShape(many);
  expect(makeupShapeSchema.safeParse(shape).success).toBe(true);
  expect(shape?.strokes).toHaveLength(8);
  expect(shape?.strokes.at(-1)?.erase).toBe(true);
  expect(regionShape([])).toBeNull();
});

test('offers a plain area for every part but the base', () => {
  for (const part of ['brow', 'eye', 'lash', 'cheek', 'shading', 'highlight', 'lip'] as const) {
    expect(makeupShapeSchema.safeParse(defaultShape(part)).success).toBe(true);
  }
  expect(defaultShape('base')).toBeNull();
  // Paired parts are drawn on both sides; the nose's highlight stays on the midline.
  expect(defaultShape('brow')?.strokes[0]?.mirror).toBe(true);
  expect(defaultShape('highlight')?.strokes[0]?.mirror).toBeUndefined();
});
