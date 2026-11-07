import { createHash } from 'node:crypto';

import { canonicalFaceModelObj } from './canonical-face-model';
import { canonicalFaceMesh, parseFaceMesh } from './face-mesh';

test('keeps the canonical face model identical to the pinned upstream file', () => {
  const sha256 = createHash('sha256').update(canonicalFaceModelObj).digest('hex');
  expect(sha256).toBe('8bac80443397e113f41a8b565ea72c59390bc031d9defab289dba7bc0c54e618');
});

test('reads the canonical mesh as 468 vertices and 898 triangles', () => {
  // MediaPipe returns 478 landmarks; the mesh covers the first 468 and the other 10 are the irises.
  expect(canonicalFaceMesh.textureCoordinates).toHaveLength(468);
  expect(canonicalFaceMesh.triangles).toHaveLength(898 * 3);
});

test('takes texture coordinates from the triangles instead of the same-numbered vt line', () => {
  // The first face is `f 174/43 156/119 134/220`. vt line 174 is (0.419054, 0.612845), which
  // belongs to another vertex; vertex 174 uses vt line 43, (0.408772, 0.626106).
  expect(canonicalFaceMesh.triangles.slice(0, 3)).toEqual([173, 155, 133]);
  const textureCoordinate = canonicalFaceMesh.textureCoordinates[173];
  expect(textureCoordinate?.x).toBeCloseTo(0.408772, 6);
  // OBJ measures v upward from the bottom of the texture; images count rows downward.
  expect(textureCoordinate?.y).toBeCloseTo(1 - 0.626106, 6);
});

test('pairs each vertex with the texture coordinate its triangle corners name', () => {
  const mesh = parseFaceMesh(
    [
      'v 0 0 0',
      'v 1 0 0',
      'v 0 1 0',
      'vt 0.1 0.2',
      'vt 0.3 0.4',
      'vt 0.5 0.6',
      'f 1/3 2/1 3/2',
    ].join('\n'),
  );
  expect(mesh.triangles).toEqual([0, 1, 2]);
  expect(mesh.textureCoordinates.map(({ x, y }) => [x, Number(y.toFixed(6))])).toEqual([
    [0.5, 0.4],
    [0.1, 0.8],
    [0.3, 0.6],
  ]);
});

test('rejects meshes that one texture coordinate per vertex cannot describe', () => {
  const vertices = ['v 0 0 0', 'v 1 0 0', 'v 0 1 0', 'v 1 1 0', 'vt 0 0', 'vt 1 0', 'vt 0 1'];
  const parseWithFaces = (...faces: string[]) => parseFaceMesh([...vertices, ...faces].join('\n'));
  // A seam gives vertex 1 two texture coordinates.
  expect(() => parseWithFaces('f 1/1 2/2 3/3', 'f 1/2 3/3 4/1')).toThrow('vertex 1');
  expect(() => parseWithFaces('f 1 2 3', 'f 2/2 4/1 3/3')).toThrow('texture coordinate');
  expect(() => parseWithFaces('f 1/1 2/2 3/3 4/1')).toThrow('triangle');
  expect(() => parseWithFaces('f 1/1 2/2 9/3', 'f 2/2 4/1 3/3')).toThrow('out of range');
  // Vertex 4 is not in any triangle, so it has no texture coordinate.
  expect(() => parseWithFaces('f 1/1 2/2 3/3')).toThrow('vertex 4');
});
