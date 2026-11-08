import type { MakeupShape } from '@starter/shared';

import type { Point } from './face-landmarks';

import { canonicalFaceMesh } from './face-mesh';

type Stroke = MakeupShape['strokes'][number];

/** One point of a painted stroke that ⑫-5 lets the user pick and move (#196). */
export type ShapeHandle = { stroke: number; point: number; uv: Point };

const uv = canonicalFaceMesh.textureCoordinates;
const triangles = canonicalFaceMesh.triangles;
// How far one press of 上・下・左・右 moves a point, in the canonical texture's UV.
export const pointStep = 0.004;
const widthStep = 1.25;
const defaultWidth = 0.02;
const clampOffset = (value: number) => Math.max(-0.2, Math.min(0.2, value));

/**
 * The points the user may move: those of painted strokes, not of the cut-outs that keep the eyes
 * and the open mouth clear. A mirrored stroke shows its points once, on the subject's right side;
 * its copy on the left follows them.
 */
export function shapeHandles(shape: MakeupShape): ShapeHandle[] {
  return shape.strokes.flatMap((stroke, strokeIndex) =>
    stroke.erase
      ? []
      : stroke.points.map(({ at, dx = 0, dy = 0 }, pointIndex) => {
          const base = uv[at] ?? { x: 0.5, y: 0.5 };
          return { stroke: strokeIndex, point: pointIndex, uv: { x: base.x + dx, y: base.y + dy } };
        }),
  );
}

/** Barycentric weights of `p` in the triangle a, b, c; null for a degenerate triangle. */
function weights(p: Point, a: Point, b: Point, c: Point): [number, number, number] | null {
  const det = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(det) < 1e-12) {
    return null;
  }
  const wa = ((b.y - c.y) * (p.x - c.x) + (c.x - b.x) * (p.y - c.y)) / det;
  const wb = ((c.y - a.y) * (p.x - c.x) + (a.x - c.x) * (p.y - c.y)) / det;
  return [wa, wb, 1 - wa - wb];
}

/**
 * Where a point of the canonical texture lands on a face whose 468 mesh vertices are `face`, as
 * the drawing does: through the mesh triangle that holds it in the texture. Outside the mesh, the
 * triangle it is closest to stretches out to reach it.
 */
export function textureToFace(point: Point, face: readonly Point[]): Point {
  let best: { w: [number, number, number]; tri: number; outside: number } | null = null;
  for (let tri = 0; tri + 2 < triangles.length; tri += 3) {
    const [ia, ib, ic] = [triangles[tri] ?? 0, triangles[tri + 1] ?? 0, triangles[tri + 2] ?? 0];
    const [a, b, c] = [uv[ia], uv[ib], uv[ic]];
    if (!a || !b || !c) {
      continue;
    }
    const w = weights(point, a, b, c);
    if (!w) {
      continue;
    }
    // How far outside the triangle the point is; 0 when inside.
    const outside = -Math.min(0, w[0]) - Math.min(0, w[1]) - Math.min(0, w[2]);
    if (!best || outside < best.outside) {
      best = { w, tri, outside };
    }
    if (outside === 0) {
      break;
    }
  }
  if (!best) {
    return { x: 0, y: 0 };
  }
  const [ia, ib, ic] = [
    triangles[best.tri] ?? 0,
    triangles[best.tri + 1] ?? 0,
    triangles[best.tri + 2] ?? 0,
  ];
  const [a, b, c] = [face[ia], face[ib], face[ic]];
  if (!a || !b || !c) {
    return { x: 0, y: 0 };
  }
  const [wa, wb, wc] = best.w;
  return { x: a.x * wa + b.x * wb + c.x * wc, y: a.y * wa + b.y * wb + c.y * wc };
}

function updateStroke(shape: MakeupShape, index: number, change: (stroke: Stroke) => Stroke) {
  return {
    strokes: shape.strokes.map((stroke, at) => (at === index ? change(stroke) : stroke)),
  };
}

/** The shape with one point moved by `dx`, `dy` in the texture; a mirrored copy moves with it. */
export function movePoint(
  shape: MakeupShape,
  handle: Pick<ShapeHandle, 'stroke' | 'point'>,
  dx: number,
  dy: number,
): MakeupShape {
  return updateStroke(shape, handle.stroke, (stroke) => ({
    ...stroke,
    points: stroke.points.map((point, at) =>
      at === handle.point
        ? {
            ...point,
            dx: clampOffset((point.dx ?? 0) + dx),
            dy: clampOffset((point.dy ?? 0) + dy),
          }
        : point,
    ),
  }));
}

/** The shape with its lines made thicker (`thicker`) or thinner; fills and cut-outs stay. */
export function changeWidth(shape: MakeupShape, thicker: boolean): MakeupShape {
  const factor = thicker ? widthStep : 1 / widthStep;
  return {
    strokes: shape.strokes.map((stroke) =>
      stroke.fill || stroke.erase
        ? stroke
        : {
            ...stroke,
            width: Math.max(0.002, Math.min(0.3, (stroke.width ?? defaultWidth) * factor)),
          },
    ),
  };
}

/** Whether the shape has any line whose width can change. */
export function hasLines(shape: MakeupShape) {
  return shape.strokes.some((stroke) => !stroke.fill && !stroke.erase);
}

/**
 * How to zoom a square box of `box` px on the points: centered on them, fitting them with `margin`
 * of their size around, never zoomed out below the whole frame or in past `maxZoom`.
 */
export function fitView(
  points: readonly Point[],
  box: number,
  { margin, maxZoom }: { margin: number; maxZoom: number },
): { zoom: number; offset: Point } {
  if (points.length === 0 || box <= 0) {
    return { zoom: 1, offset: { x: 0, y: 0 } };
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const zoom = Math.min(maxZoom, Math.max(1, box / (span * (1 + margin * 2))));
  return {
    zoom,
    offset: { x: box / 2 - ((minX + maxX) / 2) * zoom, y: box / 2 - ((minY + maxY) / 2) * zoom },
  };
}
