import type { MakeupShape } from '@starter/shared';

import type { Point } from './face-landmarks';

import { canonicalFaceMesh } from './face-mesh';

/** One stroke of a shape in the pixels of a square texture, ready to draw. */
export type ShapeStroke = {
  /** A smooth curve through the shape's points, as a polyline. */
  points: Point[];
  /** A filled outline; otherwise a line `width` wide with round ends. */
  closed: boolean;
  /** Cuts the stroke out of what is drawn before it. */
  erase: boolean;
  width: number;
  /** Soft edge, as the blur's sigma. */
  blur: number;
  opacity: number;
};

// Points sampled on each curve segment between two of the shape's points.
const samplesPerSegment = 8;

/**
 * The strokes of a shape in a `size`×`size` texture laid out like MediaPipe's canonical face
 * texture, in drawing order, each followed by its mirrored copy when it asks for one. Each point is
 * its landmark's UV moved by dx, dy; a mirrored copy flips u around 0.5, where the canonical UV is
 * symmetric.
 */
export function shapeStrokes(shape: MakeupShape, size: number): ShapeStroke[] {
  const uv = canonicalFaceMesh.textureCoordinates;
  return shape.strokes.flatMap((stroke) =>
    (stroke.mirror ? [false, true] : [false]).map((mirrored) => {
      const anchors = stroke.points.map(({ at, dx = 0, dy = 0 }) => {
        const landmark = uv[at] ?? { x: 0.5, y: 0.5 };
        const u = landmark.x + dx;
        return { x: (mirrored ? 1 - u : u) * size, y: (landmark.y + dy) * size };
      });
      const closed = stroke.fill ?? false;
      return {
        points: smoothCurve(anchors, closed),
        closed,
        erase: stroke.erase ?? false,
        width: (stroke.width ?? 0.02) * size,
        blur: ((stroke.blur ?? 0) * size) / 2,
        opacity: stroke.opacity ?? 1,
      };
    }),
  );
}

/** A Catmull-Rom curve through the points, sampled into a polyline. */
export function smoothCurve(points: Point[], closed: boolean): Point[] {
  if (points.length < 3) {
    return points;
  }
  const count = points.length;
  const at = (index: number) =>
    points[closed ? (index + count) % count : Math.min(Math.max(index, 0), count - 1)] ??
    points[0] ?? { x: 0, y: 0 };
  const segments = closed ? count : count - 1;
  const curve: Point[] = [];
  for (let segment = 0; segment < segments; segment += 1) {
    const p0 = at(segment - 1);
    const p1 = at(segment);
    const p2 = at(segment + 1);
    const p3 = at(segment + 2);
    for (let step = 0; step < samplesPerSegment; step += 1) {
      const t = step / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const blend = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      curve.push({ x: blend(p0.x, p1.x, p2.x, p3.x), y: blend(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  if (!closed) {
    curve.push(at(count - 1));
  }
  return curve;
}
