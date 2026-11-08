import type { faceTypeIds } from '@starter/shared';

import { z } from 'zod';

// Face type, eye shape, midface and brow shape from MediaPipe Face Landmarker points (#84). To add,
// remove or change a type, edit its entry in the definitions below.

export type BrowShape = 'straight' | 'softArch' | 'arch' | 'rising' | 'falling';

/** Proportions of one face, measured with the head's tilt removed. */
export type FaceMetrics = {
  /** Top of the forehead to the chin (10–152) over the cheek width (234–454). */
  length: number;
  /** Jaw width at the angles (172–397) over the cheek width. */
  jaw: number;
  /** Temple width (54–284) over the cheek width. */
  forehead: number;
  /** Angle at the chin between the jaw angles (172–152–397), in degrees; wide for a square jaw. */
  chinAngle: number;
  /** How far the outer eye corners sit above the inner ones, in degrees; negative is droopy. */
  eyeTilt: number;
  /** Eye centres to the top of the upper lip (0) over the upper lip to the chin (152). */
  midface: number;
};

/**
 * One result of a classification: its label, the definition shown as its reason, and the condition
 * on the metrics. Entries are tried in their order; the one without a condition is the default.
 */
type Definition = { label: string; basis: string; matches?: (metrics: FaceMetrics) => boolean };

// The definitions follow beauty media and face shape tools (docs/requirements.md F7). The numbers
// are provisional (#47): they are set around MediaPipe's canonical face, taken as an average 卵型,
// where length is 1.15, jaw 0.78, forehead 0.82, chinAngle 124°, eyeTilt 1.7° and midface 1.00.
export const faceTypes = {
  long: {
    label: '面長',
    basis: '横幅より縦の長さがはっきり長い',
    suitedBrow: 'straight',
    matches: (m) => m.length >= 1.25,
  },
  square: {
    label: 'ベース型',
    basis: '額・頬・あごの幅がほぼ同じで、エラが角ばっている',
    suitedBrow: 'arch',
    matches: (m) => m.jaw >= 0.82 && m.forehead >= 0.78 && m.chinAngle >= 124,
  },
  round: {
    label: '丸顔',
    basis: '縦と横の長さが近く、輪郭に丸みがある',
    suitedBrow: 'arch',
    matches: (m) => m.length < 1.1 && m.chinAngle >= 124,
  },
  heart: {
    label: '逆三角形',
    basis: '額が広く、あごが細くとがっている',
    suitedBrow: 'straight',
    matches: (m) => m.forehead - m.jaw >= 0.1 && m.chinAngle < 118,
  },
  oval: {
    label: '卵型',
    basis: '縦が横より少し長く、あごに向かってなだらかに細くなる',
    suitedBrow: 'softArch',
  },
} satisfies Record<(typeof faceTypeIds)[number], Definition & { suitedBrow: BrowShape }>;
export type FaceType = keyof typeof faceTypes;

export const eyeShapes = {
  droopy: { label: 'たれ目', basis: '目尻が目頭より下がっている', matches: (m) => m.eyeTilt < -1 },
  upturned: {
    label: 'つり目',
    basis: '目尻がはっきり上がっている',
    matches: (m) => m.eyeTilt >= 5,
  },
  standard: { label: '標準的な目', basis: '目頭と目尻がほぼ水平' },
} satisfies Record<string, Definition>;
export type EyeShape = keyof typeof eyeShapes;

// No source defines the midface in numbers, so it is shown as a rough guide.
export const midfaces = {
  short: {
    label: '中顔面短め',
    basis: '目から口までが、口からあごまでより短い',
    matches: (m) => m.midface < 0.92,
  },
  long: {
    label: '中顔面長め',
    basis: '目から口までが、口からあごまでより長い',
    matches: (m) => m.midface > 1.08,
  },
  standard: { label: '中顔面は標準', basis: '目から口までと、口からあごまでがほぼ同じ' },
} satisfies Record<string, Definition>;
export type Midface = keyof typeof midfaces;

/** The first definition whose condition the metrics meet, or the one without a condition. */
function classify<K extends string>(definitions: Record<K, Definition>, metrics: FaceMetrics): K {
  const ids = Object.keys(definitions).filter((id) => isKey(definitions, id));
  const fallback = ids.find((id) => !definitions[id].matches);
  const matched = ids.find((id) => definitions[id].matches?.(metrics) ?? false);
  const result = matched ?? fallback;
  if (result === undefined) {
    throw new Error('Definitions need one entry without a condition');
  }
  return result;
}

/** The face type, eye shape and midface of measured proportions. */
export function classifyFace(metrics: FaceMetrics) {
  return {
    faceType: classify(faceTypes, metrics),
    eye: classify(eyeShapes, metrics),
    midface: classify(midfaces, metrics),
  };
}

export const browShapes: Record<BrowShape, string> = {
  straight: '平行眉',
  softArch: '微アーチ眉',
  arch: 'アーチ眉',
  rising: '上がり眉',
  falling: '下がり眉',
};

/** A diagnosis shown on ⑭. The photo is a file on the device and only shown there. */
export type DiagnosisResult = Omit<Extract<Diagnosis, { kind: 'ok' }>, 'kind'> & {
  photo: string | undefined;
};

/** A result as route params for ⑭. */
export function resultParams(result: DiagnosisResult): Record<string, string> {
  return {
    face: result.faceType,
    eye: result.eye,
    midface: result.midface,
    ...(result.brow ? { brow: result.brow } : {}),
    ...(result.photo ? { photo: result.photo } : {}),
  };
}

// Both the image picker and camera return local files. Deep links must not load remote images.
const resultParamsSchema = z.object({
  face: z.string(),
  eye: z.string().optional().catch(undefined),
  midface: z.string().optional().catch(undefined),
  brow: z.string().optional().catch(undefined),
  photo: z
    .url({ protocol: /^file$/, hostname: /^$/ })
    .startsWith('file:///')
    .optional()
    .catch(undefined),
});

/** A result read back from ⑭'s route params; null when the face type is missing or unknown. */
export function readResultParams(params: unknown): DiagnosisResult | null {
  const parsed = resultParamsSchema.safeParse(params);
  if (!parsed.success) {
    return null;
  }
  const { face, eye, midface, brow, photo } = parsed.data;
  if (!face || !isKey(faceTypes, face)) {
    return null;
  }
  return {
    faceType: face,
    eye: eye && isKey(eyeShapes, eye) ? eye : 'standard',
    midface: midface && isKey(midfaces, midface) ? midface : 'standard',
    brow: brow && isKey(browShapes, brow) ? brow : null,
    photo,
  };
}

function isKey<K extends string>(record: Record<K, unknown>, value: string): value is K {
  return Object.hasOwn(record, value);
}

type Landmarks = { points: number[]; width: number; height: number };
type Point = { x: number; y: number };

export type Diagnosis =
  | {
      kind: 'ok';
      faceType: FaceType;
      eye: EyeShape;
      midface: Midface;
      brow: BrowShape | null;
    }
  | { kind: 'notFrontal' };

// MediaPipe landmark indices. "Right" is the person's right, on the left of the photo.
const forehead = 10;
const chin = 152;
const cheek = [234, 454] as const;
const jaw = [172, 397] as const;
const temple = [54, 284] as const;
const noseTip = 1;
const upperLip = 0;
const rightEye = { outer: 33, inner: 133, iris: [469, 470, 471, 472] };
const leftEye = { outer: 263, inner: 362, iris: [474, 475, 476, 477] };
// Upper and lower brow outlines, from the tail to the head, paired point by point.
const rightBrow = { upper: [70, 63, 105, 66, 107], lower: [46, 53, 52, 65, 55] };
const leftBrow = { upper: [300, 293, 334, 296, 336], lower: [276, 283, 282, 295, 285] };

/**
 * Brow thresholds from #47 (docs/requirements.md F7), in eye widths above the brow head.
 * Face Landmarker alone reads the peak 0.018 high and the tail 0.137 low on average, so those
 * biases are removed first. The image-based brow search of #47 is not built yet.
 */
const browBias = { peak: 0.018, tail: -0.137 };
const browThresholds = { lowPeak: 0.161, highPeak: 0.2, flatTail: 0.03, risingTail: 0.126 };

// A nose this far off the cheek midpoint (in cheek widths) means the face is turned aside.
const maxNoseOffset = 0.08;

export function diagnoseFace(landmarks: Landmarks): Diagnosis {
  const points = upright(landmarks);
  const at = (index: number) => points[index] ?? { x: 0, y: 0 };
  const cheekWidth = distance(at(cheek[0]), at(cheek[1]));
  const cheekMid = midpoint(at(cheek[0]), at(cheek[1]));
  if (cheekWidth === 0 || Math.abs(at(noseTip).x - cheekMid.x) / cheekWidth > maxNoseOffset) {
    return { kind: 'notFrontal' };
  }
  return {
    kind: 'ok',
    ...classifyFace(measureFace(at, cheekWidth)),
    brow: classifyBrow(browHeights(at)),
  };
}

/** The proportions the definitions use, from upright points. */
function measureFace(at: (index: number) => Point, cheekWidth: number): FaceMetrics {
  const rightCentre = midpoint(at(rightEye.outer), at(rightEye.inner));
  const leftCentre = midpoint(at(leftEye.outer), at(leftEye.inner));
  const eyes = midpoint(rightCentre, leftCentre);
  // Each eye's slope from the inner to the outer corner, positive when the outer corner is higher.
  const slope = (eye: { outer: number; inner: number }) =>
    (Math.atan2(at(eye.inner).y - at(eye.outer).y, Math.abs(at(eye.inner).x - at(eye.outer).x)) *
      180) /
    Math.PI;
  return {
    length: distance(at(forehead), at(chin)) / cheekWidth,
    jaw: distance(at(jaw[0]), at(jaw[1])) / cheekWidth,
    forehead: distance(at(temple[0]), at(temple[1])) / cheekWidth,
    chinAngle: angle(at(jaw[0]), at(chin), at(jaw[1])),
    eyeTilt: (slope(rightEye) + slope(leftEye)) / 2,
    midface: (at(upperLip).y - eyes.y) / (at(chin).y - at(upperLip).y),
  };
}

/** Classifies bias-corrected heights of the brow peak and tail; null when none fits. */
export function classifyBrow({ peak, tail }: { peak: number; tail: number }): BrowShape | null {
  const t = browThresholds;
  if (tail < -t.flatTail) {
    return 'falling';
  }
  if (peak >= t.highPeak) {
    if (tail >= t.risingTail) {
      return 'rising';
    }
    return tail < t.flatTail ? 'arch' : null;
  }
  if (tail >= t.risingTail) {
    return null;
  }
  if (peak >= t.lowPeak) {
    return tail >= t.flatTail ? 'softArch' : null;
  }
  return 'straight';
}

// Both brows are measured and averaged, then corrected for Face Landmarker's bias.
function browHeights(at: (index: number) => Point) {
  const eyeWidth =
    (distance(at(rightEye.outer), at(rightEye.inner)) +
      distance(at(leftEye.outer), at(leftEye.inner))) /
    2;
  const sides = [
    { brow: rightBrow, eye: rightEye },
    { brow: leftBrow, eye: leftEye },
  ].map(({ brow, eye }) => {
    // Centre line from the tail to the head.
    const line = brow.upper.map((upper, index) =>
      midpoint(at(upper), at(brow.lower[index] ?? upper)),
    );
    const head = line.at(-1) ?? { x: 0, y: 0 };
    const tail = line[0] ?? head;
    // The peak is measured halfway between the outer edge of the iris and the eye's outer corner.
    const outer = at(eye.outer);
    const irisEdge = eye.iris
      .map(at)
      .reduce((best, point) =>
        Math.abs(point.x - outer.x) < Math.abs(best.x - outer.x) ? point : best,
      );
    const peakY = heightAt(line, (irisEdge.x + outer.x) / 2);
    return { peak: (head.y - peakY) / eyeWidth, tail: (head.y - tail.y) / eyeWidth };
  });
  const average = (pick: (side: { peak: number; tail: number }) => number) =>
    sides.reduce((sum, side) => sum + pick(side), 0) / sides.length;
  return {
    peak: average((side) => side.peak) - browBias.peak,
    tail: average((side) => side.tail) - browBias.tail,
  };
}

/** Linear y on the line at x, clamped to its ends. */
function heightAt(line: Point[], x: number) {
  const sorted = [...line].sort((a, b) => a.x - b.x);
  const first = sorted[0] ?? { x, y: 0 };
  const last = sorted.at(-1) ?? first;
  if (x <= first.x) {
    return first.y;
  }
  if (x >= last.x) {
    return last.y;
  }
  for (let index = 1; index < sorted.length; index += 1) {
    const a = sorted[index - 1] ?? first;
    const b = sorted[index] ?? last;
    if (x <= b.x) {
      return b.x === a.x ? a.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
    }
  }
  return last.y;
}

/** Pixel points rotated so the eyes are level, which removes the head's tilt. */
function upright({ points, width, height }: Landmarks): Point[] {
  const pixels: Point[] = [];
  for (let index = 0; index + 1 < points.length; index += 2) {
    pixels.push({ x: (points[index] ?? 0) * width, y: (points[index + 1] ?? 0) * height });
  }
  const right = pixels[rightEye.outer];
  const left = pixels[leftEye.outer];
  if (!right || !left) {
    return pixels;
  }
  const angle = Math.atan2(left.y - right.y, left.x - right.x);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  return pixels.map(({ x, y }) => ({ x: x * cos - y * sin, y: x * sin + y * cos }));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The angle at `vertex` between the lines to `a` and `b`, in degrees. */
function angle(a: Point, vertex: Point, b: Point) {
  const turn =
    Math.atan2(b.y - vertex.y, b.x - vertex.x) - Math.atan2(a.y - vertex.y, a.x - vertex.x);
  const degrees = Math.abs((turn * 180) / Math.PI) % 360;
  return degrees > 180 ? 360 - degrees : degrees;
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
