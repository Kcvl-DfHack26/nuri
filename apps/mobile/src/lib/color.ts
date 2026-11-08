/** A color as hue (0–360), saturation and lightness (0–100), as ⑫-5's sliders hold it (#203). */
export type Hsl = { h: number; s: number; l: number };

/** #RRGGBB for a color; values outside their range are clamped. */
export function hslToHex({ h, s, l }: Hsl): string {
  const hue = (((h % 360) + 360) % 360) / 360;
  const sat = Math.min(100, Math.max(0, s)) / 100;
  const light = Math.min(100, Math.max(0, l)) / 100;
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const channel = (offset: number) => {
    // The hue wraps around the color circle.
    const t = hue + offset - Math.floor(hue + offset);
    const value =
      t < 1 / 6
        ? p + (q - p) * 6 * t
        : t < 1 / 2
          ? q
          : t < 2 / 3
            ? p + (q - p) * (2 / 3 - t) * 6
            : p;
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(1 / 3)}${channel(0)}${channel(-1 / 3)}`.toUpperCase();
}

/** Hue, saturation and lightness of #RRGGBB, rounded to whole numbers. */
export function hexToHsl(hex: string): Hsl {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round(h * 60), s: Math.round(s * 100), l: Math.round(l * 100) };
}
