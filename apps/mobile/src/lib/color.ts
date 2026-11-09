/**
 * A color as hue (0–360), saturation and brightness (0–100), as ⑫-5's palette holds it (#203): the
 * square picks saturation across and brightness down, the bar picks the hue.
 */
export type Hsv = { h: number; s: number; v: number };

/** #RRGGBB for a color; values outside their range are clamped. */
export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = (((h % 360) + 360) % 360) / 60;
  const sat = Math.min(100, Math.max(0, s)) / 100;
  const value = Math.min(100, Math.max(0, v)) / 100;
  const channel = (n: number) => {
    const k = (n + hue) % 6;
    return Math.round((value - value * sat * Math.max(0, Math.min(k, 4 - k, 1))) * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`.toUpperCase();
}

/** Hue, saturation and brightness of #RRGGBB, rounded to whole numbers. */
export function hexToHsv(hex: string): Hsv {
  const color = Number.parseInt(hex.slice(1), 16);
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const v = Math.round(max * 100);
  if (d === 0) {
    return { h: 0, s: 0, v };
  }
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round(h * 60), s: Math.round((d / max) * 100), v };
}
