import type { Cheek } from '@starter/shared';

import { cheekStyles, makeupShapeSchema } from '@starter/shared';

import { cheekShape, plainCheek } from './cheek-shape';
import { canonicalFaceMesh } from './face-mesh';
import { shapeStrokes } from './makeup-shape';

const uv = canonicalFaceMesh.textureCoordinates;
const sizes: Cheek['size'][] = ['small', 'medium', 'large'];

/** The outline's points in the canonical texture (0–1). */
function outline(cheek: Cheek) {
  const [stroke] = shapeStrokes(cheekShape(cheek), 1);
  return stroke?.points ?? [];
}

function width(cheek: Cheek) {
  const xs = outline(cheek).map((point) => point.x);
  return Math.max(...xs) - Math.min(...xs);
}

test('draws every blush type as a soft area on both cheeks', () => {
  for (const style of cheekStyles) {
    for (const size of sizes) {
      const shape = cheekShape({ style, size });
      expect(makeupShapeSchema.safeParse(shape).success).toBe(true);
      expect(shape.strokes).toHaveLength(1);
      expect(shape.strokes[0]).toMatchObject({ fill: true, mirror: true, blur: 0.03 });
    }
  }
  expect(cheekShape(plainCheek)).toEqual(cheekShape({ style: 'round', size: 'medium' }));
});

test('grows with the size and stays on the cheek, clear of the eye', () => {
  const lowerLid = Math.max(...[145, 153, 144, 163, 7].map((at) => uv[at]?.y ?? 0));
  for (const style of cheekStyles) {
    expect(width({ style, size: 'small' })).toBeLessThan(width({ style, size: 'medium' }));
    expect(width({ style, size: 'medium' })).toBeLessThan(width({ style, size: 'large' }));
    // A larger size grows down and outward; its top edge stays put, away from the eye.
    const topOf = (size: Cheek['size']) =>
      Math.min(...outline({ style, size }).map((point) => point.y));
    expect(topOf('large')).toBeCloseTo(topOf('small'), 2);
    for (const point of outline({ style, size: 'large' })) {
      // On the right half of the face (the texture's left), below the lower lid.
      expect(point.x).toBeLessThan(0.5);
      expect(point.y).toBeGreaterThan(lowerLid);
    }
  }
});

test('places the types where their names say', () => {
  const middle = (cheek: Cheek) => {
    const points = outline(cheek);
    return {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    };
  };
  const medium = (style: Cheek['style']) => middle({ style, size: 'medium' });
  // Every type but low starts just under the eye, as high as underEye; low sits below them.
  const top = (style: Cheek['style']) =>
    Math.min(...outline({ style, size: 'medium' }).map((point) => point.y));
  for (const style of cheekStyles.filter((name) => name !== 'low')) {
    expect(top(style)).toBeCloseTo(top('underEye'), 2);
  }
  expect(medium('low').y).toBeGreaterThan(medium('round').y);
  expect(medium('underEye').y).toBeLessThan(medium('round').y);
  // The diagonal reaches farther out toward the temple than the round blush.
  const outer = (style: Cheek['style']) =>
    Math.min(...outline({ style, size: 'medium' }).map((point) => point.x));
  expect(outer('diagonal')).toBeLessThan(outer('round'));
});
