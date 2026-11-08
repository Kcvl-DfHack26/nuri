import { finishLayers, paintColor } from './face-makeup';

test('uses the middle recommended color and falls back to black when none is given', () => {
  expect(paintColor(['#FFFFFF', '#CC6633', '#000000'])).toBe('#CC6633');
  expect(paintColor(['#FFFFFF', '#CC6633'])).toBe('#CC6633');
  expect(paintColor([])).toBe('#000000');
});

test('paints parts in display order and uses the last step for repeated parts', () => {
  expect(
    finishLayers([
      { part: 'brow', colors: ['#201008'] },
      { part: 'eye', colors: ['#003366'] },
      { part: 'base', colors: ['#F0D0B0'] },
      { part: 'brow', colors: ['#402010', '#503020', '#604030'] },
      { part: 'shading', colors: ['#A07850'] },
    ]),
  ).toEqual([
    { part: 'base', color: '#F0D0B0' },
    { part: 'shading', color: '#A07850' },
    { part: 'eye', color: '#003366' },
    { part: 'brow', color: '#503020' },
  ]);
  expect(finishLayers([])).toEqual([]);
});
