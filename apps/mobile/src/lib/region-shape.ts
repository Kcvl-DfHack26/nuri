import type { MakeupShape, makeupParts, PostAnalysis } from '@starter/shared';

import type { Point } from './face-landmarks';

import { cheekShape, plainCheek } from './cheek-shape';
import { canonicalFaceMesh } from './face-mesh';

type Region = PostAnalysis['steps'][number]['regions'][number];
type PartId = (typeof makeupParts)[number];
type Stroke = MakeupShape['strokes'][number];
type ShapePoint = Stroke['points'][number];
/** A landmark, or the midpoint of two. */
type Landmark = number | readonly [number, number];
/** The landmarks of a paired part: the subject's right, then left. */
type Sided = readonly [Landmark, Landmark];

const uv = canonicalFaceMesh.textureCoordinates;
const at = (index: number): Point => uv[index] ?? { x: 0.5, y: 0.5 };

// The words Gemini picks (#46) as MediaPipe landmark numbers; Gemini never answers numbers.
const sided: Partial<Record<Region['start'], Sided>> = {
  browHead: [107, 336],
  browPeak: [105, 334],
  browTail: [46, 276],
  eyeInner: [133, 362],
  eyeOuter: [33, 263],
  irisCenter: [
    [159, 145],
    [386, 374],
  ],
  irisOuter: [
    [161, 163],
    [388, 390],
  ],
  noseWing: [129, 358],
  mouthCorner: [61, 291],
  cheekboneTop: [117, 346],
  cheekCenter: [50, 280],
  temple: [139, 368],
  jawAngle: [172, 397],
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
// The right, then the left brow and eye, each from the outer end to the inner end.
const browUpper = [
  [70, 63, 105, 66, 107],
  [300, 293, 334, 296, 336],
] as const;
const browLower = [
  [46, 53, 52, 65, 55],
  [276, 283, 282, 295, 285],
] as const;
// The upper lid skips 246/466, which bend up at the outer corner in many faces.
const upperLid = [
  [33, 161, 160, 159, 158, 157, 173, 133],
  [263, 388, 387, 386, 385, 384, 398, 362],
] as const;
const lowerLid = [
  [33, 7, 163, 144, 145, 153, 154, 155, 133],
  [263, 249, 390, 373, 374, 380, 381, 382, 362],
] as const;
const eyeOpening = [
  [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7],
  [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249],
] as const;
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
// Gemini names the lower lid in many ways in its description (#203).
const lowerLidWords =
  /下まぶた|下瞼|涙袋|粘膜|下まつ|目の下|目尻の下|下側|下のライン|下ライン|アンダー/;
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
// How far the eye hole reaches from the upper lid toward the brow (#203).
const eyeHoleShare = 0.55;
// How many lid landmarks a line drawn inward from a corner covers, by length.
// Eyeshadow is cut out of a slightly larger eye opening, as a share of the eye's width, so a frame
// whose eye landmarks sit a little inside the lids does not leave color on the whites (#203). Liner
// keeps the opening itself to stay on the lash line.
const shadowHoleMargin = 0.02;
// A line from an eye corner without an end follows the whole lid unless Gemini says it is short
// (#203: liner and shadow along the lid were cut to a few points).
const inwardSteps: Record<Region['length'], number> = {
  none: Infinity,
  short: 2,
  medium: 4,
  long: Infinity,
};

const side = (right: boolean) => (right ? 0 : 1);
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

function anchor(name: Region['start'], right: boolean): { point: Point; near: number } | null {
  const pair = sided[name];
  const landmark = pair ? pair[side(right)] : center[name];
  if (landmark !== undefined) {
    return landmarkOf(landmark);
  }
  if (name === 'browTailLine') {
    // Where the line from the nose wing through the outer eye corner reaches the brow tail's height.
    const wing = at(right ? 129 : 358);
    const corner = at(right ? 33 : 263);
    const tail = at(right ? 46 : 276);
    const t = (tail.y - wing.y) / (corner.y - wing.y);
    return {
      point: { x: wing.x + (corner.x - wing.x) * t, y: tail.y },
      near: right ? 46 : 276,
    };
  }
  return null;
}

function strokeAnchors(region: Region, right: boolean) {
  return {
    start: anchor(region.start, right),
    end: region.end === 'none' ? null : anchor(region.end, right),
  };
}

/** Whether an area belongs to a paired part; the midline and the lips are not paired. */
function isPaired(region: Region) {
  const central = (name: Region['end']) => name === 'none' || name in center || lipAreas.has(name);
  return !central(region.start) || !central(region.end);
}

function direction(name: Region['direction'], right: boolean): Point {
  // The canonical UV has the subject's right on the left half.
  const out = right ? -1 : 1;
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

function areaStrokes(name: Region['start'] | Region['clip'], right: boolean): Stroke[] {
  const fill = (indices: readonly number[], erase = false): Stroke => ({
    points: indices.map((index) => ({ at: index })),
    fill: true,
    ...(erase ? { erase: true } : { blur }),
  });
  if (name === 'brow') {
    const k = side(right);
    return [fill([...browUpper[k], ...[...browLower[k]].reverse()])];
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
function browStroke(region: Region, right: boolean): Stroke {
  const k = side(right);
  const middles = browLower[k].map((lower, index) => {
    const upper = browUpper[k][index] ?? lower;
    return { x: (at(upper).x + at(lower).x) / 2, y: (at(upper).y + at(lower).y) / 2, near: lower };
  });
  const thickness =
    browUpper[k].reduce((sum, upper, index) => {
      const lower = browLower[k][index] ?? upper;
      return sum + Math.hypot(at(upper).x - at(lower).x, at(upper).y - at(lower).y);
    }, 0) / browUpper[k].length;
  const { start, end } = strokeAnchors(region, right);
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

/**
 * A line along an eyelid. A lid edge without an end is the whole edge; a line from an eye landmark
 * without an end follows part of the lid from it (#203). A band is wider and moved away from the
 * eye, such as shadow under a lower line. An outward line from the outer corner gets a short wing.
 */
function lidStroke(region: Region, lower: boolean, right: boolean, whole: boolean): Stroke {
  const contour = (lower ? lowerLid : upperLid)[side(right)].map((index) => ({
    ...at(index),
    near: index,
  }));
  const last = contour.length - 1;
  const { start, end } = strokeAnchors(region, right);
  const from = start ? nearestIndex(contour, start.point) : 0;
  const reach = Math.min(last, Math.max(2, inwardSteps[region.length]));
  const toward = from >= last / 2 ? Math.max(0, from - reach) : Math.min(last, from + reach);
  const wholeEnd = from === 0 ? last : 0;
  const to = end ? nearestIndex(contour, end.point) : whole ? wholeEnd : toward;
  let [lo, hi] = from <= to ? [from, to] : [to, from];
  // Both ends on one lid point would draw almost nothing; reach the next point (#203).
  if (lo === hi) {
    [lo, hi] = hi < last ? [lo, hi + 1] : [lo - 1, hi];
  }
  const band = region.shape === 'band';
  const shift = band ? (lower ? 1 : -1) * widths.band * 0.6 : 0;
  const points: ShapePoint[] = contour
    .slice(lo, hi + 1)
    .map((point) =>
      shift === 0 ? { at: point.near } : pointAt({ x: point.x, y: point.y + shift }, point.near),
    );
  const outward = ['outward', 'upOutward', 'downOutward'].includes(region.direction);
  const wing = lengths[region.length] || (outward ? lengths.short : 0);
  const corner = contour[0];
  if (lo === 0 && !lower && wing > 0 && corner && region.direction !== 'inward') {
    const way = direction(region.direction, right);
    points.unshift(
      pointAt({ x: corner.x + way.x * wing, y: corner.y + way.y * wing + shift }, corner.near),
    );
  }
  return { points, width: band ? widths.band : widths.line, blur };
}

/**
 * The whole eye area (#203): the eye hole from the upper lid up to the brow's lower edge, or under
 * the eye from the lower lid down. The eye opening is cut out afterwards.
 */
function eyeAreaStroke(lower: boolean, right: boolean, reach: number): Stroke {
  const k = side(right);
  // Shadow is often blended past the outer corner toward the temple (#203).
  const corner = at(right ? 33 : 263);
  const out = direction('outward', right);
  const tip = pointAt(
    { x: corner.x + out.x * reach, y: corner.y + (lower ? 0.25 : -0.35) * reach },
    right ? 33 : 263,
  );
  if (!lower) {
    // The eye hole reaches a little over halfway from the lid to the brow, not up to the brow.
    const lid = upperLid[k].map((index) => ({ ...at(index), near: index }));
    const brow = browLower[k].map((index) => at(index));
    const top = [...lid].reverse().map((point) => {
      const above = brow.reduce((best, candidate) =>
        Math.abs(candidate.x - point.x) < Math.abs(best.x - point.x) ? candidate : best,
      );
      return pointAt({ x: point.x, y: point.y + (above.y - point.y) * eyeHoleShare }, point.near);
    });
    return {
      points: [...lid.map((point) => ({ at: point.near })), ...top, tip],
      fill: true,
      blur,
    };
  }
  const lid = lowerLid[k].map((index) => ({ ...at(index), near: index }));
  const depth = eyeWidth * 0.35;
  return {
    points: [
      ...lid.map((point) => ({ at: point.near })),
      ...[...lid].reverse().map((point) => pointAt({ x: point.x, y: point.y + depth }, point.near)),
      tip,
    ],
    fill: true,
    blur,
  };
}

function ellipseStroke(region: Region, right: boolean): Stroke | null {
  const { start, end } = strokeAnchors(region, right);
  if (!start) {
    return null;
  }
  const axis = end
    ? { x: end.point.x - start.point.x, y: end.point.y - start.point.y }
    : direction(region.direction, right);
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

function straightStroke(region: Region, right: boolean): Stroke | null {
  const { start, end } = strokeAnchors(region, right);
  if (!start) {
    return null;
  }
  const way = direction(region.direction, right);
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

/** The strokes of one area on the subject's right side, or with `right` false, the left side. */
// How far eye shadow is blended past the outer corner, as a share of the way to the temple (#203).
const templeShare = 0.5;

/**
 * How far an eye area reaches past the outer corner: halfway to the temple when Gemini says it goes
 * outward or gives a length, a quarter of the way otherwise.
 */
function outwardReach(region: Region, right: boolean) {
  const corner = at(right ? 33 : 263);
  const temple = at(right ? 139 : 368);
  const toTemple = Math.hypot(temple.x - corner.x, temple.y - corner.y);
  const outward =
    region.length !== 'none' || ['outward', 'upOutward', 'downOutward'].includes(region.direction);
  return toTemple * templeShare * (outward ? 1 : 0.5);
}

/**
 * An area around the eye (#203): the eye hole or under the eye for a whole area, a line toward a
 * landmark off the lid (such as the temple), or a line along the lid. A lid edge without an end is
 * the whole edge.
 */
function eyeStrokes(region: Region, right: boolean): Stroke[] {
  const lower =
    region.start === 'lowerLidEdge' ||
    region.end === 'lowerLidEdge' ||
    lowerLidWords.test(region.detail);
  if (region.shape === 'area') {
    return [eyeAreaStroke(lower, right, outwardReach(region, right))];
  }
  const fromEdge = region.start.endsWith('LidEdge');
  const from: Region = fromEdge ? { ...region, start: 'eyeOuter' } : region;
  const endsOnEye =
    region.end === 'none' || eyeAnchors.has(region.end) || region.end.endsWith('LidEdge');
  if (!endsOnEye) {
    // Toward a landmark off the lid, such as the temple, the line stops halfway there.
    const { start, end } = strokeAnchors(from, right);
    if (!start || !end) {
      return [];
    }
    const half = {
      x: start.point.x + (end.point.x - start.point.x) * templeShare,
      y: start.point.y + (end.point.y - start.point.y) * templeShare,
    };
    return [
      {
        points: [pointAt(start.point, start.near), pointAt(half, start.near)],
        width: widths[region.shape] || widths.line,
        blur,
      },
    ];
  }
  return [lidStroke(from, lower, right, fromEdge && region.end === 'none')];
}

function regionStrokes(region: Region, right: boolean): Stroke[] {
  const eyeNamed = eyeAnchors.has(region.start) || region.start.endsWith('LidEdge');
  if (eyeNamed && region.shape !== 'ellipse' && region.shape !== 'dot') {
    return eyeStrokes(region, right);
  }
  if (region.shape === 'area') {
    const area = areaStrokes(region.start, right);
    if (area.length > 0) {
      return area;
    }
    const clipped = areaStrokes(region.clip, right);
    if (clipped.length > 0) {
      return clipped;
    }
    // A whole area named by one landmark, such as the cheek, is an ellipse around it, not
    // dropped (#203).
    const ellipse = ellipseStroke({ ...region, shape: 'ellipse' }, right);
    return ellipse ? [ellipse] : [];
  }
  if (region.shape === 'ellipse' || region.shape === 'dot') {
    const ellipse = ellipseStroke(region, right);
    return ellipse ? [ellipse] : [];
  }
  if (browAnchors.has(region.start) || region.start === 'brow' || region.start === 'browTailLine') {
    return [browStroke(region, right)];
  }
  const straight = straightStroke(region, right);
  return straight ? [straight] : [];
}

const noseCenter = new Set<Region['end']>(['glabella', 'noseRoot', 'noseBridge', 'noseTip']);

/**
 * A nose shadow named only by the middle of the nose (#203): drawn along the side of the nose,
 * a little toward the subject's right, and mirrored, since shading never sits on the bridge.
 */
function noseSideStrokes(region: Region): Stroke[] {
  const { start, end } = strokeAnchors(region, true);
  if (!start) {
    return [];
  }
  const side = -eyeWidth * 0.3;
  const from = { x: start.point.x + side, y: start.point.y };
  const to = end ? { x: end.point.x + side, y: end.point.y } : { x: from.x, y: from.y + eyeWidth };
  return [
    {
      points: [pointAt(from, start.near), pointAt(to, end?.near ?? start.near)],
      width: widths.band,
      blur: blur * 3,
    },
  ];
}

/** The subject's right eye opening; for eyeshadow, pushed out from the eye's center a little. */
function eyeHole(widen: boolean): ShapePoint[] {
  const ring = eyeOpening[0];
  if (!widen) {
    return ring.map((index) => ({ at: index }));
  }
  const center = {
    x: ring.reduce((sum, index) => sum + at(index).x, 0) / ring.length,
    y: ring.reduce((sum, index) => sum + at(index).y, 0) / ring.length,
  };
  return ring.map((index) => {
    const point = at(index);
    const distance = Math.hypot(point.x - center.x, point.y - center.y);
    const push = (eyeWidth * shadowHoleMargin) / distance;
    return pointAt(
      {
        x: point.x + (point.x - center.x) * push,
        y: point.y + (point.y - center.y) * push,
      },
      index,
    );
  });
}

/**
 * ⑫-3 (#156): the areas Gemini found in one step as the shape ⑦⑩ paint (#138), or null when nothing
 * can be drawn. Brows, eyes, cheeks and other paired parts are always painted on both sides, even
 * when Gemini saw only one side painted, so a guide never shows one brow; Gemini's left, right or
 * center is not used.
 */
export function regionShape(regions: readonly Region[], part?: PartId): MakeupShape | null {
  const paint: Stroke[] = [];
  const drawn = new Set<string>();
  let touchesEyes = false;
  let touchesLips = false;
  for (const region of regions) {
    const noseShadow =
      part === 'shading' && noseCenter.has(region.start) && noseCenter.has(region.end);
    const paired = noseShadow || isPaired(region);
    const strokes = noseShadow ? noseSideStrokes(region) : regionStrokes(region, true);
    // A paired area is drawn on the subject's right side and mirrored to the left.
    for (const stroke of strokes) {
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
    cut.push({ points: eyeHole(part === 'eye'), fill: true, erase: true, mirror: true });
  }
  if (touchesLips) {
    cut.push({ points: mouthOpening.map((index) => ({ at: index })), fill: true, erase: true });
  }
  const strokes = [...paint.slice(0, 8 - cut.length), ...cut];
  return paint.length > 0 ? { strokes } : null;
}

const region = (fields: Pick<Region, 'start' | 'shape'> & Partial<Region>): Region => ({
  detail: '',
  side: 'both',
  end: 'none',
  length: 'none',
  direction: 'none',
  clip: 'none',
  ...fields,
});

// ⑫-5's 範囲を追加 (#196): a plain area for each part, in the words Gemini answers with. The base
// covers the whole face, so it gets none.
const partRegions: Record<PartId, Region[] | null> = {
  base: null,
  brow: [region({ start: 'browHead', end: 'browTail', shape: 'line' })],
  eye: [region({ start: 'eyeInner', end: 'eyeOuter', shape: 'band', detail: '上まぶた' })],
  lash: [
    region({
      start: 'eyeInner',
      end: 'eyeOuter',
      shape: 'line',
      length: 'short',
      direction: 'upOutward',
      detail: '上まぶたのきわ',
    }),
  ],
  // Blush is drawn by type (#224), not from landmarks.
  cheek: null,
  shading: [region({ start: 'browHead', end: 'noseWing', shape: 'line' })],
  highlight: [region({ side: 'center', start: 'noseRoot', end: 'noseTip', shape: 'line' })],
  lip: [region({ side: 'center', start: 'lips', shape: 'area' })],
};

/** A plain area for the part that the user then shapes on ⑫-5; null for the base. */
export function defaultShape(part: PartId): MakeupShape | null {
  if (part === 'cheek') {
    return cheekShape(plainCheek);
  }
  const regions = partRegions[part];
  return regions ? regionShape(regions, part) : null;
}
