import type { Point } from './face-landmarks';

import { canonicalFaceModelObj } from './canonical-face-model';

/** A triangle mesh whose vertex numbers are MediaPipe's landmark numbers. */
export type FaceMesh = {
  /**
   * Texture position of each vertex, indexed by vertex number. x and y run 0–1 across the texture
   * image, with y measured downward from its top.
   */
  textureCoordinates: Point[];
  /** Zero-based vertex numbers, three per triangle. */
  triangles: number[];
};

type Corner = { vertex: number; texture: number };

/**
 * Reads the triangles and the vertices' texture coordinates from Wavefront OBJ text. Each triangle
 * corner names a vertex and a texture coordinate separately (`f 174/43 ...`), and vertex i's texture
 * coordinate is generally not `vt` line i, so the pairs come from the corners. Throws when a vertex
 * has no texture coordinate or more than one, because the landmarks are drawn as indexed vertices
 * that each carry one texture coordinate.
 */
export function parseFaceMesh(objText: string): FaceMesh {
  let vertexCount = 0;
  const textureLines: Point[] = [];
  const corners: Corner[] = [];
  for (const line of objText.split('\n')) {
    const [keyword, ...fields] = line.trim().split(/\s+/);
    if (keyword === 'v') {
      vertexCount += 1;
    } else if (keyword === 'vt') {
      textureLines.push(parseTextureCoordinate(fields));
    } else if (keyword === 'f') {
      corners.push(...parseTriangle(fields));
    }
  }
  return {
    textureCoordinates: pairTextureCoordinates(corners, vertexCount, textureLines),
    triangles: corners.map((corner) => corner.vertex),
  };
}

/** MediaPipe's canonical face mesh. A malformed model throws when the app loads this module. */
export const canonicalFaceMesh = parseFaceMesh(canonicalFaceModelObj);

/**
 * The canonical mesh's 468 vertices are MediaPipe's first 468 landmarks; the 10 after them are the
 * irises, which the mesh does not cover.
 */
export const canonicalVertexCount = canonicalFaceMesh.textureCoordinates.length;

function parseTextureCoordinate(fields: string[]): Point {
  const u = Number(fields[0]);
  const v = Number(fields[1]);
  if (!Number.isFinite(u) || !Number.isFinite(v)) {
    throw new Error(`Texture coordinate "${fields.join(' ')}" is not a pair of numbers`);
  }
  // OBJ measures v upward from the bottom of the texture; images count rows downward.
  return { x: u, y: 1 - v };
}

function parseTriangle(fields: string[]): Corner[] {
  if (fields.length !== 3) {
    throw new Error(`Expected a triangle but found a face with ${fields.length} corners`);
  }
  return fields.map((field) => {
    const [vertex, texture] = field.split('/');
    if (!texture) {
      throw new Error(`Face corner ${field} has no texture coordinate`);
    }
    // OBJ numbers vertices and texture coordinates from 1.
    return { vertex: Number(vertex) - 1, texture: Number(texture) - 1 };
  });
}

function pairTextureCoordinates(
  corners: Corner[],
  vertexCount: number,
  textureLines: Point[],
): Point[] {
  const textureByVertex: (number | undefined)[] = Array.from({ length: vertexCount });
  for (const { vertex, texture } of corners) {
    const isVertexInRange = Number.isInteger(vertex) && vertex >= 0 && vertex < vertexCount;
    if (!isVertexInRange || textureLines[texture] === undefined) {
      throw new Error(`Face corner ${vertex + 1}/${texture + 1} is out of range`);
    }
    const paired = textureByVertex[vertex];
    if (paired !== undefined && paired !== texture) {
      throw new Error(`OBJ vertex ${vertex + 1} has more than one texture coordinate`);
    }
    textureByVertex[vertex] = texture;
  }
  return textureByVertex.map((texture, vertex) => {
    const coordinate = texture === undefined ? undefined : textureLines[texture];
    if (coordinate === undefined) {
      throw new Error(
        `OBJ vertex ${vertex + 1} is in no triangle, so it has no texture coordinate`,
      );
    }
    return coordinate;
  });
}
