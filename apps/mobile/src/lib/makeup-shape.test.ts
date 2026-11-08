import type { MakeupShape } from '@starter/shared';

import { canonicalFaceMesh } from './face-mesh';
import { shapeStrokes, smoothCurve } from './makeup-shape';

const uv = canonicalFaceMesh.textureCoordinates;

test('places points at their landmarks moved by dx, dy, and mirrors them across the middle', () => {
  const shape: MakeupShape = {
    strokes: [
      { mirror: true, width: 0.01, blur: 0.004, points: [{ at: 33, dx: -0.01, dy: 0.02 }] },
    ],
  };
  const [right, left] = shapeStrokes(shape, 1000);
  const eye = uv[33] ?? { x: 0, y: 0 };
  expect(right?.points[0]?.x).toBeCloseTo((eye.x - 0.01) * 1000);
  expect(right?.points[0]?.y).toBeCloseTo((eye.y + 0.02) * 1000);
  expect(left?.points[0]?.x).toBeCloseTo((1 - (eye.x - 0.01)) * 1000);
  // Width and blur scale with the texture; the blur becomes a sigma of half the soft edge.
  expect(right).toMatchObject({ closed: false, erase: false, width: 10, blur: 2, opacity: 1 });
});

test('keeps the drawing order, mirrors only the strokes that ask, and keeps cut-outs', () => {
  const mouth = [{ at: 61 }, { at: 0 }, { at: 291 }, { at: 17 }];
  const shape: MakeupShape = {
    strokes: [
      { fill: true, opacity: 0.5, points: mouth },
      { mirror: true, points: [{ at: 33 }] },
      { erase: true, fill: true, points: mouth },
    ],
  };
  const strokes = shapeStrokes(shape, 512);
  expect(strokes.map(({ closed, erase }) => ({ closed, erase }))).toEqual([
    { closed: true, erase: false },
    { closed: false, erase: false },
    { closed: false, erase: false },
    { closed: true, erase: true },
  ]);
  expect(strokes[0]?.opacity).toBe(0.5);
});

test('smooths a curve through every point and keeps the open ends', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    { x: 20, y: 0 },
  ];
  const open = smoothCurve(points, false);
  expect(open[0]).toEqual(points[0]);
  expect(open.at(-1)).toEqual(points[2]);
  expect(open).toContainEqual({ x: 10, y: 10 });
  // A closed curve returns to its start without repeating it.
  expect(smoothCurve(points, true)).toHaveLength(24);
});
