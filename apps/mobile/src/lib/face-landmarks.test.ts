import { toViewPoints } from './face-landmarks';

test('mirrors points and fills a view with the same aspect ratio', () => {
  const points = toViewPoints(
    [0, 0, 0.25, 0.5, 1, 1],
    { width: 720, height: 1280 },
    { width: 360, height: 640 },
  );
  expect(points).toEqual([
    { x: 360, y: 0 },
    { x: 270, y: 320 },
    { x: 0, y: 640 },
  ]);
});

test('crops the sides when the frame is wider than the view', () => {
  // A 3:4 frame filling a 9:16 view is scaled to the view height and cropped left and right.
  const [left, center, right] = toViewPoints(
    [0, 0.5, 0.5, 0.5, 1, 0.5],
    { width: 480, height: 640 },
    { width: 360, height: 640 },
  );
  expect(left).toEqual({ x: 420, y: 320 });
  expect(center).toEqual({ x: 180, y: 320 });
  expect(right).toEqual({ x: -60, y: 320 });
});

test('crops the top and bottom when the frame is taller than the view', () => {
  const [top, bottom] = toViewPoints(
    [0.5, 0, 0.5, 1],
    { width: 720, height: 1280 },
    { width: 400, height: 400 },
  );
  // Scaled to the view width: the 711pt-tall frame overflows the 400pt view by 155.5pt on each side.
  expect(top?.x).toBeCloseTo(200);
  expect(top?.y).toBeCloseTo(-155.56, 1);
  expect(bottom?.y).toBeCloseTo(555.56, 1);
});

test('ignores unknown frame sizes and incomplete coordinate pairs', () => {
  expect(toViewPoints([0.5, 0.5], { width: 0, height: 0 }, { width: 100, height: 100 })).toEqual(
    [],
  );
  expect(
    toViewPoints([0.5, 0.5, 0.1], { width: 100, height: 100 }, { width: 100, height: 100 }),
  ).toHaveLength(1);
});

test('projects only the points needed for the mesh', () => {
  expect(
    toViewPoints(
      [0, 0, 0.25, 0.5, 1, 1],
      { width: 720, height: 1280 },
      { width: 360, height: 640 },
      2,
    ),
  ).toEqual([
    { x: 360, y: 0 },
    { x: 270, y: 320 },
  ]);
});
