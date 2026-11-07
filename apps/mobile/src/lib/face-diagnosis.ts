// Face type and brow shape from one photo's MediaPipe Face Landmarker points (#84).
// Everything here runs on device; the photo and its points are never sent anywhere.

export type FaceType = 'round' | 'long' | 'square' | 'heart' | 'oval';
export type BrowShape = 'straight' | 'softArch' | 'arch' | 'rising' | 'falling';

export const faceTypes: Record<FaceType, { label: string; suitedBrow: BrowShape }> = {
  round: { label: '丸顔', suitedBrow: 'arch' },
  long: { label: '面長', suitedBrow: 'straight' },
  square: { label: 'ベース型', suitedBrow: 'arch' },
  heart: { label: '逆三角形', suitedBrow: 'straight' },
  oval: { label: '卵型', suitedBrow: 'softArch' },
};

export const browShapes: Record<BrowShape, string> = {
  straight: '平行眉',
  softArch: '微アーチ眉',
  arch: 'アーチ眉',
  rising: '上がり眉',
  falling: '下がり眉',
};

export function isFaceType(value: string): value is FaceType {
  return Object.hasOwn(faceTypes, value);
}

export function isBrowShape(value: string): value is BrowShape {
  return Object.hasOwn(browShapes, value);
}

type Landmarks = { points: number[]; width: number; height: number };
type Point = { x: number; y: number };

export type Diagnosis =
  | { kind: 'ok'; faceType: FaceType; brow: BrowShape | null }
  | { kind: 'notFrontal' };

// MediaPipe landmark indices. "Right" is the person's right, on the left of the photo.
const forehead = 10;
const chin = 152;
const cheek = [234, 454] as const;
const jaw = [172, 397] as const;
const temple = [54, 284] as const;
const noseTip = 1;
const rightEye = { outer: 33, inner: 133, iris: [469, 470, 471, 472] };
const leftEye = { outer: 263, inner: 362, iris: [474, 475, 476, 477] };
// Upper and lower brow outlines, from the tail to the head, paired point by point.
const rightBrow = { upper: [70, 63, 105, 66, 107], lower: [46, 53, 52, 65, 55] };
const leftBrow = { upper: [300, 293, 334, 296, 336], lower: [276, 283, 282, 295, 285] };

/**
 * Face type thresholds are provisional (#84): the team has not decided them yet (#47). They are
 * set around MediaPipe's canonical face, taken as an average 卵型, whose length (points 10–152)
 * is 1.15 cheek widths (234–454), jaw (172–397) 0.78 and temples (54–284) 0.82 of it.
 */
const faceTypeThresholds = { short: 1.1, long: 1.25, wideJaw: 0.82, narrowJaw: 0.1 };

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
    faceType: classifyFace({
      length: distance(at(forehead), at(chin)) / cheekWidth,
      jaw: distance(at(jaw[0]), at(jaw[1])) / cheekWidth,
      temple: distance(at(temple[0]), at(temple[1])) / cheekWidth,
    }),
    brow: classifyBrow(browHeights(at)),
  };
}

export function classifyFace({
  length,
  jaw: jawWidth,
  temple: templeWidth,
}: {
  length: number;
  jaw: number;
  temple: number;
}): FaceType {
  if (length >= faceTypeThresholds.long) {
    return 'long';
  }
  if (jawWidth >= faceTypeThresholds.wideJaw) {
    return 'square';
  }
  if (length < faceTypeThresholds.short) {
    return 'round';
  }
  if (templeWidth - jawWidth >= faceTypeThresholds.narrowJaw) {
    return 'heart';
  }
  return 'oval';
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

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
