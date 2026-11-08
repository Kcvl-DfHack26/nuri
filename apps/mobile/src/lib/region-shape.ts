import type { MakeupShape, PostAnalysis } from '@starter/shared';

import type { Point } from './face-landmarks';

import { canonicalFaceMesh } from './face-mesh';

type Region = PostAnalysis['steps'][number]['regions'][number];
type Stroke = MakeupShape['strokes'][number];
type ShapePoint = Stroke['points'][number];
/** A landmark, or the midpoint of two. */
type Landmark = number | readonly [number, number];

const uv = canonicalFaceMesh.textureCoordinates;
const at = (index: number): Point => uv[index] ?? { x: 0.5, y: 0.5 };

// The words Gemini picks (#46) as MediaPipe landmark numbers; Gemini never answers numbers. Paired
// parts are drawn on the subject's right side, the left half of the canonical UV, and mirrored.
const sided: Partial<Record<Region['start'], Landmark>> = {
  browHead: 107,
  browPeak: 105,
  browTail: 46,
  eyeInner: 133,
  eyeOuter: 33,
  irisCenter: [159, 145],
  irisOuter: [161, 163],
  noseWing: 129,
  mouthCorner: 61,
  cheekboneTop: 117,
  cheekCenter: 50,
  temple: 139,
  jawAngle: 172,
};
const center: Partial<Record<Region['start'], Landmark>> = {
  glabella: 9,
  noseRoot: 168,
  noseBridge: 197,
  noseTip: 1,
  upperLipCenter: [0, 13],
  lowerLipCenter: [17, 14],
  chin: 152,
  foreheadCenter: 151,
};
// The right brow and eye, each from the outer end to the inner end.
const browUpper = [70, 63, 105, 66, 107];
const browLower = [46, 53, 52, 65, 55];
// The upper lid skips 246, which bends up at the outer corner in many faces.
const upperLid = [33, 161, 160, 159, 158, 157, 173, 133];
const lowerLid = [33, 7, 163, 144, 145, 153, 154, 155, 133];
const eyeOpening = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
const upperLip = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191, 78,
];
const lowerLip = [
  291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324,
  308,
];
const mouthOpening = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
];
const eyeAnchors = new Set<Region['start']>(['eyeInner', 'eyeOuter', 'irisCenter', 'irisOuter']);
const browAnchors = new Set<Region['start']>(['browHead', 'browPeak', 'browTail']);
const lipAreas = new Set<Region['end']>(['upperLip', 'lowerLip', 'lips']);

// Widths and lengths come from the face, not from Gemini (#46): the eye's width in UV.
const eyeWidth = Math.hypot(at(33).x - at(133).x, at(33).y - at(133).y);
const widths: Record<Region['shape'], number> = {
  dot: eyeWidth * 0.08,
  line: eyeWidth * 0.07,
  band: eyeWidth * 0.12,
  ellipse: eyeWidth * 0.35,
  arc: eyeWidth * 0.07,
  area: 0,
};
const lengths: Record<Region['length'], number> = {
  none: 0,
  short: eyeWidth * 0.12,
  medium: eyeWidth * 0.22,
  long: eyeWidth * 0.35,
};
const blur = 0.004;
// How many lid landmarks a line drawn inward from a corner covers, by length.
const inwardSteps: Record<Region['length'], number> = { none: 2, short: 2, medium: 3, long: 5 };

const clampOffset = (value: number) => Math.max(-0.2, Math.min(0.2, value));

/** A shape point at `target`, written as the nearest of `near`'s landmarks plus a small offset. */
function pointAt(target: Point, near: number): ShapePoint {
  const base = at(near);
  return { at: near, dx: clampOffset(target.x - base.x), dy: clampOffset(target.y - base.y) };
}

function landmarkOf(entry: Landmark): { point: Point; near: number } {
  if (typeof entry === 'number') {
    return { point: at(entry), near: entry };
  }
  const [a, b] = entry;
  return {
    point: { x: (at(a).x + at(b).x) / 2, y: (at(a).y + at(b).y) / 2 },
    near: a,
  };
}

function anchor(name: Region['start']): { point: Point; near: number } | null {
  const landmark = sided[name] ?? center[name];
  if (landmark !== undefined) {
    return landmarkOf(landmark);
  }
  if (name === 'browTailLine') {
    // Where the line from the nose wing through the outer eye corner reaches the brow tail's height.
    const wing = at(129);
    const corner = at(33);
    const tail = at(46);
    const t = (tail.y - wing.y) / (corner.y - wing.y);
    return { point: { x: wing.x + (corner.x - wing.x) * t, y: tail.y }, near: 46 };
  }
  return null;
}

/** A paired part's area, drawn on the right side and mirrored; the midline and the lips are not. */
function isPaired(region: Region) {
  const central = (name: Region['end']) => name === 'none' || name in center || lipAreas.has(name);
  return !central(region.start) || !central(region.end);
}

function direction(name: Region['direction']): Point {
  // The subject's right side is the left half of the canonical UV.
  const out = -1;
  const vectors: Record<Region['direction'], Point> = {
    none: { x: out, y: 0 },
    outward: { x: out, y: 0 },
    inward: { x: -out, y: 0 },
    upOutward: { x: out, y: -0.6 },
    downOutward: { x: out, y: 0.6 },
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
  };
  const v = vectors[name];
  const length = Math.hypot(v.x, v.y);
  return { x: v.x / length, y: v.y / length };
}

const nearestIndex = (points: readonly Point[], target: Point) =>
  points.reduce(
    (best, point, index) =>
      Math.hypot(point.x - target.x, point.y - target.y) <
      Math.hypot((points[best]?.x ?? 0) - target.x, (points[best]?.y ?? 0) - target.y)
        ? index
        : best,
    0,
  );

function areaStrokes(name: Region['start'] | Region['clip']): Stroke[] {
  const fill = (indices: readonly number[], erase = false): Stroke => ({
    points: indices.map((index) => ({ at: index })),
    fill: true,
    ...(erase ? { erase: true } : { blur }),
  });
  if (name === 'brow') {
    return [fill([...browUpper, ...[...browLower].reverse()])];
  }
  if (name === 'upperLip') {
    return [fill(upperLip)];
  }
  if (name === 'lowerLip') {
    return [fill(lowerLip)];
  }
  if (name === 'lips') {
    return [fill(upperLip), fill(lowerLip)];
  }
  return [];
}

/** A line along the brow's middle, as wide as the brow at most, stretched past the tail if asked. */
function browStroke(region: Region): Stroke {
  const middles = browLower.map((lower, index) => {
    const upper = browUpper[index] ?? lower;
    return { x: (at(upper).x + at(lower).x) / 2, y: (at(upper).y + at(lower).y) / 2, near: lower };
  });
  const thickness =
    browUpper.reduce((sum, upper, index) => {
      const lower = browLower[index] ?? upper;
      return sum + Math.hypot(at(upper).x - at(lower).x, at(upper).y - at(lower).y);
    }, 0) / browUpper.length;
  const start = anchor(region.start);
  const end = region.end === 'none' ? null : anchor(region.end);
  const from = start ? nearestIndex(middles, start.point) : 0;
  const to = end ? nearestIndex(middles, end.point) : from;
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  const points = middles.slice(lo, hi + 1).map((middle) => pointAt(middle, middle.near));
  const extra = lengths[region.length];
  const tail = middles[0];
  const next = middles[1];
  if (!end && extra > 0 && tail && next) {
    // Drawing past the tail: continue the brow's own direction outward.
    const dx = tail.x - next.x;
    const dy = tail.y - next.y;
    const scale = extra / Math.hypot(dx, dy);
    points.unshift(pointAt({ x: tail.x + dx * scale, y: tail.y + dy * scale }, tail.near));
  }
  return { points, width: Math.min(widths[region.shape] || widths.line, thickness), blur };
}

/** A line along an eyelid between two eye landmarks, with a short wing past the outer corner. */
function lidStroke(region: Region, lower: boolean): Stroke {
  const contour = (lower ? lowerLid : upperLid).map((index) => ({ ...at(index), near: index }));
  const start = anchor(region.start);
  const end = region.end === 'none' ? null : anchor(region.end);
  const from = start ? nearestIndex(contour, start.point) : 0;
  let to = end ? nearestIndex(contour, end.point) : from;
  if (!end && region.direction === 'inward') {
    to = Math.min(contour.length - 1, from + inwardSteps[region.length]);
  }
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  const points: ShapePoint[] = contour.slice(lo, hi + 1).map((point) => ({ at: point.near }));
  const wing = lengths[region.length];
  const corner = contour[0];
  if (lo === 0 && !lower && wing > 0 && corner && region.direction !== 'inward') {
    const way = direction(region.direction);
    points.unshift(
      pointAt({ x: corner.x + way.x * wing, y: corner.y + way.y * wing }, corner.near),
    );
  }
  if (points.length === 1 && points[0]) {
    // A dot-like flick, e.g. at the inner corner: a very short line keeps a round cap.
    points.push({ at: points[0].at, dx: 0.001 });
  }
  return { points, width: widths.line, blur };
}

function ellipseStroke(region: Region): Stroke | null {
  const start = anchor(region.start);
  if (!start) {
    return null;
  }
  const end = region.end === 'none' ? null : anchor(region.end);
  const axis = end
    ? { x: end.point.x - start.point.x, y: end.point.y - start.point.y }
    : direction(region.direction);
  // The ellipse sits on the start; the end only tilts it. Blush from the cheekbone toward the
  // temple stays on the cheekbone instead of moving up beside the eye.
  const centerPoint = start.point;
  const minor = (region.shape === 'dot' ? widths.dot : widths.ellipse) / 2;
  const major = Math.max(
    end ? Math.hypot(axis.x, axis.y) * 0.3 : lengths[region.length] / 2,
    region.shape === 'dot' ? minor : minor * 1.6,
  );
  const angle = Math.atan2(axis.y, axis.x);
  const points = Array.from({ length: 12 }, (_, index) => {
    const t = (index / 12) * Math.PI * 2;
    const x = Math.cos(t) * major;
    const y = Math.sin(t) * minor;
    return pointAt(
      {
        x: centerPoint.x + x * Math.cos(angle) - y * Math.sin(angle),
        y: centerPoint.y + x * Math.sin(angle) + y * Math.cos(angle),
      },
      start.near,
    );
  });
  return { points, fill: true, blur };
}

function straightStroke(region: Region): Stroke | null {
  const start = anchor(region.start);
  if (!start) {
    return null;
  }
  const end = region.end === 'none' ? null : anchor(region.end);
  const way = direction(region.direction);
  const length = lengths[region.length] || widths.band;
  const to = end
    ? pointAt(end.point, end.near)
    : pointAt({ x: start.point.x + way.x * length, y: start.point.y + way.y * length }, start.near);
  return {
    points: [pointAt(start.point, start.near), to],
    width: widths[region.shape] || widths.line,
    blur,
  };
}

function regionStrokes(region: Region): Stroke[] {
  if (region.shape === 'area') {
    const area = areaStrokes(region.start);
    return area.length > 0 ? area : areaStrokes(region.clip);
  }
  if (region.shape === 'ellipse' || region.shape === 'dot') {
    const ellipse = ellipseStroke(region);
    return ellipse ? [ellipse] : [];
  }
  if (browAnchors.has(region.start) || region.start === 'brow' || region.start === 'browTailLine') {
    return [browStroke(region)];
  }
  if (region.start === 'upperLidEdge' || region.start === 'lowerLidEdge') {
    return [lidStroke({ ...region, start: 'eyeOuter' }, region.start === 'lowerLidEdge')];
  }
  if (eyeAnchors.has(region.start)) {
    // Gemini names the lid only in its description.
    return [lidStroke(region, region.detail.includes('下まぶた'))];
  }
  const straight = straightStroke(region);
  return straight ? [straight] : [];
}

/**
 * ⑫-3 (#156): the areas Gemini found in one step as the shape ⑦⑩ paint (#138), or null when nothing
 * can be drawn. Brows, eyes, cheeks and other paired parts are always painted on both sides, even
 * when Gemini saw only one side painted, so a guide never shows one brow; Gemini's left, right or
 * center is not used.
 */
export function regionShape(regions: readonly Region[]): MakeupShape | null {
  const paint: Stroke[] = [];
  const drawn = new Set<string>();
  let touchesEyes = false;
  let touchesLips = false;
  for (const region of regions) {
    const paired = isPaired(region);
    for (const stroke of regionStrokes(region)) {
      const painted = paired ? { ...stroke, mirror: true } : stroke;
      // The same area seen on the left and on the right is one mirrored stroke.
      const key = JSON.stringify(painted);
      if (!drawn.has(key)) {
        drawn.add(key);
        paint.push(painted);
      }
    }
    touchesEyes ||= eyeAnchors.has(region.start) || region.start.endsWith('LidEdge');
    touchesLips ||= ['upperLip', 'lowerLip', 'lips', 'upperLipCenter', 'lowerLipCenter'].includes(
      region.start,
    );
  }
  // Never paint the eyes themselves or the open mouth.
  const cut: Stroke[] = [];
  if (touchesEyes) {
    cut.push({
      points: eyeOpening.map((index) => ({ at: index })),
      fill: true,
      erase: true,
      mirror: true,
    });
  }
  if (touchesLips) {
    cut.push({ points: mouthOpening.map((index) => ({ at: index })), fill: true, erase: true });
  }
  const strokes = [...paint.slice(0, 8 - cut.length), ...cut];
  return paint.length > 0 ? { strokes } : null;
}
