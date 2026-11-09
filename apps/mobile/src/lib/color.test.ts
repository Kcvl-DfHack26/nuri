import { hexToHsv, hsvToHex } from './color';

test('turns hue, saturation and brightness into #RRGGBB and back', () => {
  expect(hsvToHex({ h: 0, s: 100, v: 100 })).toBe('#FF0000');
  expect(hsvToHex({ h: 120, s: 100, v: 50 })).toBe('#008000');
  expect(hsvToHex({ h: 240, s: 100, v: 100 })).toBe('#0000FF');
  expect(hsvToHex({ h: 360, s: 100, v: 100 })).toBe('#FF0000');
  expect(hsvToHex({ h: 0, s: 0, v: 0 })).toBe('#000000');
  expect(hsvToHex({ h: 0, s: 0, v: 100 })).toBe('#FFFFFF');
  expect(hexToHsv('#FF0000')).toEqual({ h: 0, s: 100, v: 100 });
  expect(hexToHsv('#808080')).toEqual({ h: 0, s: 0, v: 50 });
  // A makeup color survives the round trip within a step of the palette.
  const brown = hexToHsv('#C56D42');
  const back = hexToHsv(hsvToHex(brown));
  expect(Math.abs(back.h - brown.h)).toBeLessThanOrEqual(1);
  expect(Math.abs(back.s - brown.s)).toBeLessThanOrEqual(1);
  expect(Math.abs(back.v - brown.v)).toBeLessThanOrEqual(1);
});
