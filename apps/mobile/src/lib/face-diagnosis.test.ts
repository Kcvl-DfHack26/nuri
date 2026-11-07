import { canonicalFaceModelObj } from './canonical-face-model';
import { classifyBrow, classifyFace, diagnoseFace } from './face-diagnosis';

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

test('reads the canonical face as 卵型 even when the head is tilted', () => {
  const level = diagnoseFace(canonicalPhoto());
  expect(level).toMatchObject({ kind: 'ok', faceType: 'oval' });
  expect(diagnoseFace(canonicalPhoto({ tilt: 0.2 }))).toEqual(level);
});

test('asks for a frontal photo when the face is turned aside', () => {
  expect(diagnoseFace(canonicalPhoto({ noseShift: 0.15 }))).toEqual({ kind: 'notFrontal' });
});

test('classifies face types with the provisional proportions', () => {
  expect(classifyFace({ length: 1.15, jaw: 0.78, temple: 0.82 })).toBe('oval');
  expect(classifyFace({ length: 1.3, jaw: 0.78, temple: 0.82 })).toBe('long');
  expect(classifyFace({ length: 1.05, jaw: 0.78, temple: 0.82 })).toBe('round');
  expect(classifyFace({ length: 1.15, jaw: 0.85, temple: 0.86 })).toBe('square');
  expect(classifyFace({ length: 1.15, jaw: 0.72, temple: 0.85 })).toBe('heart');
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
