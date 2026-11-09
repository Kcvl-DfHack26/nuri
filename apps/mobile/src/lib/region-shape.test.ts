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

test('cuts eyeshadow out of a slightly larger eye opening, but keeps liner on the lash line', () => {
  const lid = [region({ detail: '上まぶた', start: 'eyeInner', end: 'eyeOuter', shape: 'band' })];
  const hole = (part: 'eye' | 'lash') => regionShape(lid, part)?.strokes.at(-1)?.points ?? [];
  const liner = hole('lash');
  expect(liner.every((point) => point.dx === undefined && point.dy === undefined)).toBe(true);
  const shadow = hole('eye');
  expect(shadow.map((point) => point.at)).toEqual(liner.map((point) => point.at));
  // Each point moves out from the eye's center by a few percent of the eye's width.
  const eyeWidth = Math.hypot(
    (uv[33]?.x ?? 0) - (uv[133]?.x ?? 0),
    (uv[33]?.y ?? 0) - (uv[133]?.y ?? 0),
  );
  for (const point of shadow) {
    const moved = Math.hypot(point.dx ?? 0, point.dy ?? 0);
    expect(moved).toBeCloseTo(eyeWidth * 0.02, 5);
  }
  // The inner and outer corners move away from each other.
  expect(shadow[0]?.dx).toBeLessThan(0);
  expect(shadow[8]?.dx).toBeGreaterThan(0);
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

describe('the cases #203 found in a posted recipe', () => {
  const paint = (regions: Region[]) =>
    (regionShape(regions)?.strokes ?? []).filter((stroke) => !stroke.erase);

  test('lines the whole upper lid edge, not one point', () => {
    const [line] = paint([region({ start: 'upperLidEdge', shape: 'line', end: 'none' })]);
    const ats = new Set(line?.points.map((point) => point.at));
    expect(ats.size).toBeGreaterThanOrEqual(8);
  });

  test('follows part of the lid from the outer corner even without an end or length', () => {
    const [line] = paint([region({ start: 'eyeOuter', end: 'none', shape: 'line' })]);
    expect(new Set(line?.points.map((point) => point.at)).size).toBeGreaterThanOrEqual(3);
    // An outward line gets a wing past the corner.
    const [wing] = paint([
      region({ start: 'eyeOuter', end: 'none', shape: 'line', direction: 'upOutward' }),
    ]);
    expect(wing?.points[0]?.dy).toBeLessThan(0);
  });

  test('puts shadow under a lower line lower and wider than the line', () => {
    const lowerLine = region({ start: 'lowerLidEdge', end: 'none', shape: 'line' });
    const [line] = paint([lowerLine]);
    const [shadow] = paint([{ ...lowerLine, shape: 'band' }]);
    expect(shadow?.width).toBeGreaterThan(line?.width ?? 0);
    expect(shadow?.points.every((point) => (point.dy ?? 0) > 0)).toBe(true);
    expect(line?.points.every((point) => (point.dy ?? 0) === 0)).toBe(true);
  });

  test('fills the eye hole and under the eye instead of dropping them', () => {
    const [hole] = paint([region({ start: 'upperLidEdge', end: 'none', shape: 'area' })]);
    expect(hole).toMatchObject({ fill: true, mirror: true });
    // From the upper lid up to a little over halfway to the brow, not up to the brow itself.
    expect(hole?.points.map((point) => point.at)).toContain(159);
    expect(hole?.points.map((point) => point.at)).not.toContain(52);
    const top = hole?.points.filter((point) => (point.dy ?? 0) < 0) ?? [];
    expect(top.length).toBeGreaterThanOrEqual(8);
    const [under] = paint([region({ start: 'lowerLidEdge', end: 'none', shape: 'area' })]);
    expect(under?.fill).toBe(true);
    expect(
      makeupShapeSchema.safeParse(regionShape([region({ start: 'eyeInner', shape: 'area' })]))
        .success,
    ).toBe(true);
  });
});

test('reads the lower lid from the many words Gemini uses for it', () => {
  for (const detail of ['涙袋の影', '下の粘膜', '下瞼の目尻側', '目の下にライン']) {
    const [line] =
      regionShape([region({ start: 'eyeInner', end: 'eyeOuter', detail })])?.strokes ?? [];
    // The lower lid's landmarks, not the upper lid's.
    expect(line?.points.map((point) => point.at)).toEqual(expect.arrayContaining([145]));
    expect(line?.points.map((point) => point.at)).not.toContain(159);
  }
});

test('never draws a lid line of one point', () => {
  const [line] = (
    regionShape([region({ start: 'irisCenter', end: 'irisCenter', detail: '涙袋' })])?.strokes ?? []
  ).filter((stroke) => !stroke.erase);
  expect(new Set(line?.points.map((point) => point.at)).size).toBeGreaterThanOrEqual(2);
});

test('carries eye shadow past the outer corner toward the temple', () => {
  const paint = (regions: Region[]) =>
    (regionShape(regions)?.strokes ?? []).filter((stroke) => !stroke.erase);
  // The eye hole ends a little past the outer corner, further when Gemini says outward.
  const [hole] = paint([region({ start: 'upperLidEdge', shape: 'area', direction: 'upOutward' })]);
  const tip = hole?.points.at(-1);
  expect(tip?.at).toBe(33);
  expect(tip?.dx).toBeLessThan(0);
  // From the outer corner toward the temple: a line that stops halfway there.
  const [wing] = paint([region({ start: 'eyeOuter', end: 'temple', shape: 'band' })]);
  const end = wing?.points.at(-1);
  const corner = uv[33] ?? { x: 0, y: 0 };
  const temple = uv[139] ?? { x: 0, y: 0 };
  expect(end?.at).toBe(33);
  expect(end?.dx).toBeCloseTo((temple.x - corner.x) / 2);
  expect(end?.dy).toBeCloseTo((temple.y - corner.y) / 2);
});

test('draws a cheek named by one landmark as an ellipse instead of dropping it', () => {
  const shape = regionShape(
    [region({ start: 'cheekboneTop', end: 'temple', shape: 'area' })],
    'cheek',
  );
  expect(shape?.strokes[0]).toMatchObject({ fill: true, mirror: true });
  expect(makeupShapeSchema.safeParse(shape).success).toBe(true);
});

test('puts a nose shadow named by the middle of the nose on both sides of it', () => {
  const nose = region({ side: 'center', start: 'noseRoot', end: 'noseBridge', shape: 'line' });
  const [shadow] = regionShape([nose], 'shading')?.strokes ?? [];
  expect(shadow?.mirror).toBe(true);
  expect(shadow?.points.every((point) => (point.dx ?? 0) < 0)).toBe(true);
  // A highlight on the bridge stays in the middle.
  expect(regionShape([nose], 'highlight')?.strokes[0]?.mirror).toBeUndefined();
});

test('lines the whole lid from a corner unless Gemini says the line is short', () => {
  const stroke = (fields: Partial<Region>) =>
    (
      regionShape([region({ start: 'eyeOuter', end: 'none', shape: 'line', ...fields })])
        ?.strokes ?? []
    ).filter((item) => !item.erase)[0];
  // Upper liner along the lash line, as in the siren eye video.
  expect(stroke({ detail: '上まぶたのキワ' })?.points.map((point) => point.at)).toEqual(
    expect.arrayContaining([33, 159, 133]),
  );
  // Orange right under the lower line.
  expect(
    stroke({ detail: '下まぶたの黒ラインのすぐ下', shape: 'band' })?.points.map(
      (point) => point.at,
    ),
  ).toEqual(expect.arrayContaining([33, 145, 133]));
  // A short flick stays at the corner.
  expect(
    stroke({ length: 'short', direction: 'inward' })?.points.map((point) => point.at),
  ).not.toContain(133);
});
