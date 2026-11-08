import { paintColor, recipeLayers } from './face-makeup';

test('uses the middle recommended color and falls back to black when none is given', () => {
  expect(paintColor(['#FFFFFF', '#CC6633', '#000000'])).toBe('#CC6633');
  expect(paintColor(['#FFFFFF', '#CC6633'])).toBe('#CC6633');
  expect(paintColor([])).toBe('#000000');
});

test('paints only the read areas of a posted recipe, and standard textures elsewhere', () => {
  const lip = { strokes: [{ fill: true, points: [{ at: 61 }, { at: 0 }, { at: 291 }] }] };
  const layers = [
    { part: 'brow' as const, color: '#503020', shape: null },
    { part: 'lip' as const, color: '#C04050', shape: lip },
  ];
  expect(recipeLayers('p-3f2b8c1e', layers)).toEqual([layers[1]]);
  expect(recipeLayers('fox-eye', layers)).toEqual(layers);
});
