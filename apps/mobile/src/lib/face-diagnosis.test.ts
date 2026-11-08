import { canonicalFaceModelObj } from './canonical-face-model';
import {
  classifyBrow,
  classifyFace,
  diagnoseFace,
  readResultParams,
  resultParams,
} from './face-diagnosis';

// MediaPipe's canonical face seen from the front, as a 1000×1000 photo with y going down. Its 468
// vertices have no iris points, so each iris is placed around its eye's centre.
function canonicalPhoto({ tilt = 0, noseShift = 0 } = {}) {
  const vertices = canonicalFaceModelObj
    .split('\n')
    .filter((line) => line.startsWith('v '))
    .map((line) => line.split(/\s+/).slice(1, 3).map(Number));
  const xs = vertices.map(([x = 0]) => x);
  const ys = vertices.map(([, y = 0]) => y);
  const minX = Math.min(...xs);
  const maxY = Math.max(...ys);
  const scale = 1 / Math.max(Math.max(...xs) - minX, maxY - Math.min(...ys));
  const points = vertices.map(([x = 0, y = 0]) => ({
    x: (x - minX) * scale,
    y: (maxY - y) * scale,
  }));
  const centre = (a: number, b: number) => ({
    x: ((points[a]?.x ?? 0) + (points[b]?.x ?? 0)) / 2,
    y: ((points[a]?.y ?? 0) + (points[b]?.y ?? 0)) / 2,
  });
  for (const [a, b] of [
    [33, 133],
    [263, 362],
  ] as const) {
    const eye = centre(a, b);
    points.push(
      eye,
      { x: eye.x + 0.015, y: eye.y },
      { x: eye.x, y: eye.y - 0.015 },
      { x: eye.x - 0.015, y: eye.y },
      { x: eye.x, y: eye.y + 0.015 },
    );
  }
  const nose = points[1];
  if (nose) {
    nose.x += noseShift;
  }
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  return {
    points: points.flatMap(({ x, y }) => [
      0.5 + (x - 0.5) * cos - (y - 0.5) * sin,
      0.5 + (x - 0.5) * sin + (y - 0.5) * cos,
    ]),
    width: 1000,
    height: 1000,
  };
}

test('reads the canonical face as 卵型 with standard eyes and midface, even when tilted', () => {
  const level = diagnoseFace(canonicalPhoto());
  expect(level).toMatchObject({
    kind: 'ok',
    faceType: 'oval',
    eye: 'standard',
    midface: 'standard',
  });
  expect(diagnoseFace(canonicalPhoto({ tilt: 0.2 }))).toEqual(level);
});

test('asks for a frontal photo when the face is turned aside', () => {
  expect(diagnoseFace(canonicalPhoto({ noseShift: 0.15 }))).toEqual({ kind: 'notFrontal' });
});

// The canonical face's metrics; each case changes only what its definition looks at.
const standard = {
  length: 1.15,
  jaw: 0.78,
  forehead: 0.82,
  chinAngle: 124,
  eyeTilt: 1.7,
  midface: 1,
};

test('classifies face types by their definitions, in order', () => {
  const faceType = (change: Partial<typeof standard>) =>
    classifyFace({ ...standard, ...change }).faceType;
  expect(faceType({})).toBe('oval');
  expect(faceType({ length: 1.3 })).toBe('long');
  // Wide jaw and forehead with an angular chin; a narrow forehead is not ベース型.
  expect(faceType({ jaw: 0.85, forehead: 0.84, chinAngle: 130 })).toBe('square');
  expect(faceType({ jaw: 0.85, forehead: 0.7, chinAngle: 130 })).not.toBe('square');
  // Short with a rounded chin; short with a pointed chin is not 丸顔.
  expect(faceType({ length: 1.05, chinAngle: 126 })).toBe('round');
  expect(faceType({ length: 1.05, chinAngle: 115 })).not.toBe('round');
  // Wide forehead, narrow jaw and a pointed chin.
  expect(faceType({ jaw: 0.72, forehead: 0.85, chinAngle: 112 })).toBe('heart');
  // 面長 comes first when a face meets more than one definition.
  expect(faceType({ length: 1.3, jaw: 0.85, forehead: 0.84, chinAngle: 130 })).toBe('long');
});

test('classifies eye shapes and the midface by their definitions', () => {
  const classify = (change: Partial<typeof standard>) => classifyFace({ ...standard, ...change });
  expect(classify({ eyeTilt: -3 }).eye).toBe('droopy');
  expect(classify({ eyeTilt: 7 }).eye).toBe('upturned');
  expect(classify({ eyeTilt: 0 }).eye).toBe('standard');
  expect(classify({ midface: 0.85 }).midface).toBe('short');
  expect(classify({ midface: 1.15 }).midface).toBe('long');
  expect(classify({ midface: 1 }).midface).toBe('standard');
});

test('round-trips a result through route params and ignores unknown values', () => {
  const result = {
    faceType: 'round' as const,
    eye: 'droopy' as const,
    midface: 'short' as const,
    brow: 'arch' as const,
    photo: 'file:///face.jpg',
  };
  expect(readResultParams(resultParams(result))).toEqual(result);
  expect(readResultParams({ face: 'round', eye: 'sleepy', midface: 'tiny' })).toEqual({
    faceType: 'round',
    eye: 'standard',
    midface: 'standard',
    brow: null,
    photo: undefined,
  });
  expect(readResultParams({ face: 'triangle' })).toBeNull();
});

test('classifies brows with the thresholds decided in #47', () => {
  expect(classifyBrow({ peak: 0.14, tail: 0.05 })).toBe('straight');
  expect(classifyBrow({ peak: 0.18, tail: 0.08 })).toBe('softArch');
  expect(classifyBrow({ peak: 0.22, tail: 0 })).toBe('arch');
  expect(classifyBrow({ peak: 0.22, tail: 0.15 })).toBe('rising');
  expect(classifyBrow({ peak: 0.3, tail: -0.05 })).toBe('falling');
  // Combinations outside the table are not classified.
  expect(classifyBrow({ peak: 0.22, tail: 0.08 })).toBeNull();
  expect(classifyBrow({ peak: 0.18, tail: 0 })).toBeNull();
  expect(classifyBrow({ peak: 0.14, tail: 0.2 })).toBeNull();
});
