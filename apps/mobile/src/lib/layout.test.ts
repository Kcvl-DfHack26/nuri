import { cardGrid, hasRoomForSidePanel } from './layout';

test.each([
  [320, 1, 288],
  [390, 2, 175],
  [834, 4, 194],
  [1194, 7, 159],
])('fits cards within the measured width of %d', (width, columns, cardWidth) => {
  expect(cardGrid(width)).toEqual({ columns, cardWidth });
});

test('splits the preview and controls only when there is room beside the preview', () => {
  expect(hasRoomForSidePanel(390, 844)).toBe(false);
  expect(hasRoomForSidePanel(834, 1194)).toBe(false);
  expect(hasRoomForSidePanel(1194, 834)).toBe(true);
});
