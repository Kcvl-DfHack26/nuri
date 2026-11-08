import { hexToHsl, hslToHex } from './color';

test('turns hue, saturation and lightness into #RRGGBB and back', () => {
  expect(hslToHex({ h: 0, s: 100, l: 50 })).toBe('#FF0000');
  expect(hslToHex({ h: 120, s: 100, l: 25 })).toBe('#008000');
  expect(hslToHex({ h: 0, s: 0, l: 0 })).toBe('#000000');
  expect(hslToHex({ h: 0, s: 0, l: 100 })).toBe('#FFFFFF');
  expect(hexToHsl('#FF0000')).toEqual({ h: 0, s: 100, l: 50 });
  expect(hexToHsl('#808080')).toEqual({ h: 0, s: 0, l: 50 });
  // A makeup color survives the round trip within a step of the sliders.
  const brown = hexToHsl('#C56D42');
  const back = hexToHsl(hslToHex(brown));
  expect(Math.abs(back.h - brown.h)).toBeLessThanOrEqual(1);
  expect(Math.abs(back.l - brown.l)).toBeLessThanOrEqual(1);
});
