import type { MakeupShape } from '@starter/shared';

import { makeupShapeSchema } from '@starter/shared';

import {
  changeWidth,
  fitView,
  hasLines,
  movePoint,
  pointStep,
  shapeHandles,
  textureToFace,
} from './area-edit';
import { canonicalFaceMesh } from './face-mesh';

const uv = canonicalFaceMesh.textureCoordinates;
const shape: MakeupShape = {
  strokes: [
    { mirror: true, width: 0.01, points: [{ at: 46 }, { at: 52, dx: 0.01 }] },
    { fill: true, erase: true, mirror: true, points: [{ at: 33 }, { at: 159 }, { at: 133 }] },
  ],
};

test('offers the points of painted strokes, not of the cut-outs', () => {
  const handles = shapeHandles(shape);
  expect(handles.map(({ stroke, point }) => [stroke, point])).toEqual([
    [0, 0],
    [0, 1],
  ]);
  expect(handles[1]?.uv.x).toBeCloseTo((uv[52]?.x ?? 0) + 0.01);
});

test('places a texture point on the face through the mesh, like the drawing', () => {
  // A face that is the canonical texture scaled up and moved lands every point the same way.
  const face = uv.map((point) => ({ x: point.x * 400 + 10, y: point.y * 300 + 20 }));
  const at = uv[52] ?? { x: 0, y: 0 };
  const placed = textureToFace({ x: at.x + 0.003, y: at.y - 0.002 }, face);
  expect(placed.x).toBeCloseTo((at.x + 0.003) * 400 + 10, 1);
  expect(placed.y).toBeCloseTo((at.y - 0.002) * 300 + 20, 1);
  // Outside the mesh, the nearest triangle stretches to reach it.
  const outside = textureToFace({ x: 0.5, y: 0.001 }, face);
  expect(Number.isFinite(outside.x) && Number.isFinite(outside.y)).toBe(true);
});

test('moves only the picked point and keeps the shape valid', () => {
  const moved = movePoint(shape, { stroke: 0, point: 1 }, -pointStep, pointStep);
  expect(moved.strokes[0]?.points).toEqual([
    { at: 46 },
    { at: 52, dx: 0.01 - pointStep, dy: pointStep },
  ]);
  expect(moved.strokes[1]).toBe(shape.strokes[1]);
  // Offsets stay within what the schema allows.
  const far = movePoint(shape, { stroke: 0, point: 0 }, 1, -1);
  expect(far.strokes[0]?.points[0]).toEqual({ at: 46, dx: 0.2, dy: -0.2 });
  expect(makeupShapeSchema.safeParse(far).success).toBe(true);
});

test('makes lines thicker or thinner but leaves fills and cut-outs', () => {
  expect(changeWidth(shape, true).strokes[0]?.width).toBeCloseTo(0.0125);
  expect(changeWidth(shape, false).strokes[0]?.width).toBeCloseTo(0.008);
  expect(changeWidth(shape, true).strokes[1]).toEqual(shape.strokes[1]);
  expect(hasLines(shape)).toBe(true);
  expect(hasLines({ strokes: [{ fill: true, points: [{ at: 1 }, { at: 2 }, { at: 3 }] }] })).toBe(
    false,
  );
});

test('zooms in on the points with a margin, within the limits', () => {
  const points = [
    { x: 100, y: 100 },
    { x: 120, y: 110 },
  ];
  const { zoom, offset } = fitView(points, 300, { margin: 0.5, maxZoom: 4 });
  // 20 px wide with half of it on each side is 40 px: the most zoom, 4, applies.
  expect(zoom).toBe(4);
  expect(offset).toEqual({ x: 150 - 110 * 4, y: 150 - 105 * 4 });
  // Spread-out points are never zoomed out below the whole frame.
  expect(
    fitView(
      [
        { x: 0, y: 0 },
        { x: 600, y: 600 },
      ],
      300,
      { margin: 0.5, maxZoom: 4 },
    ).zoom,
  ).toBe(1);
  expect(fitView([], 300, { margin: 0.5, maxZoom: 4 })).toEqual({
    zoom: 1,
    offset: { x: 0, y: 0 },
  });
});
