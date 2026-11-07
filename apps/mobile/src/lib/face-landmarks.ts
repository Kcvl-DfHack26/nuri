export type Size = { width: number; height: number };
export type Point = { x: number; y: number };

/**
 * Maps landmarks normalized to the upright, unmirrored camera frame onto a view that shows the
 * frame like the front camera preview: scaled to fill the view, centered and cropped, and mirrored.
 * `points` holds flat x, y pairs.
 */
export function toViewPoints(points: readonly number[], frame: Size, view: Size): Point[] {
  if (frame.width <= 0 || frame.height <= 0) {
    return [];
  }
  const scale = Math.max(view.width / frame.width, view.height / frame.height);
  const offsetX = (view.width - frame.width * scale) / 2;
  const offsetY = (view.height - frame.height * scale) / 2;
  const result: Point[] = [];
  for (let index = 0; index + 1 < points.length; index += 2) {
    const x = (points[index] ?? 0) * frame.width * scale + offsetX;
    const y = (points[index + 1] ?? 0) * frame.height * scale + offsetY;
    result.push({ x: view.width - x, y });
  }
  return result;
}
