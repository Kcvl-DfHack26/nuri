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

// Names for ⑦'s suggested colors (#224), in the words cosmetics use. A color takes the name whose
// sample looks nearest (CIE76 distance in Lab), so similar shades read alike.
const colorNames: readonly (readonly [name: string, hex: string])[] = [
  ['ブラック', '#1A1A1A'],
  ['チャコールグレー', '#3C3C3C'],
  ['グレー', '#8C8C8C'],
  ['ホワイト', '#F8F8F8'],
  ['アイボリー', '#F6EEDC'],
  ['ダークブラウン', '#3B2A20'],
  ['ブラウン', '#7A5038'],
  ['モカブラウン', '#8B6B57'],
  ['ライトブラウン', '#A87C5F'],
  ['キャメル', '#B5835A'],
  ['ベージュ', '#DDC0A0'],
  ['テラコッタ', '#B9573A'],
  ['ブロンズ', '#8C5A2B'],
  ['ゴールド', '#C9A44C'],
  ['シャンパンゴールド', '#E8D3A3'],
  ['レッド', '#C8102E'],
  ['ボルドー', '#6D1F2E'],
  ['ブリックレッド', '#9B3B2E'],
  ['ローズ', '#C24A6B'],
  ['ローズピンク', '#D9718E'],
  ['フューシャピンク', '#D63384'],
  ['ピンク', '#F0A0B4'],
  ['ベビーピンク', '#F8CFD8'],
  ['コーラルピンク', '#F08A7E'],
  ['コーラル', '#EE7660'],
  ['ピーチ', '#F6B38E'],
  ['オレンジ', '#EE8434'],
  ['ローズブラウン', '#9E5C5A'],
  ['ピンクブラウン', '#B07A72'],
  ['モーブ', '#A57C95'],
  ['プラム', '#7A3B5A'],
  ['パープル', '#7D4A9E'],
  ['ラベンダー', '#B8A2D8'],
  ['カーキ', '#7A7444'],
  ['ネイビー', '#23335A'],
  ['ブルー', '#3C6CB4'],
  ['グリーン', '#3E8E5E'],
];

/** CIE Lab of #RRGGBB (sRGB, D65). */
function hexToLab(hex: string): [number, number, number] {
  const color = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [16, 8, 0].map((shift) => {
    const c = ((color >> shift) & 255) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const xyz = [
    (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047,
    0.2126 * r + 0.7152 * g + 0.0722 * b,
    (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883,
  ].map((t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 / 116) * t + 16 / 116)) as [
    number,
    number,
    number,
  ];
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
}

const namedLabs = colorNames.map(([name, hex]) => ({ name, lab: hexToLab(hex) }));

/** The cosmetics name for #RRGGBB, e.g. ブラウン for #79513A; null when it is not #RRGGBB. */
export function colorName(hex: string): string | null {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return null;
  }
  const [l, a, b] = hexToLab(hex);
  let best = namedLabs[0];
  let bestDistance = Infinity;
  for (const named of namedLabs) {
    const distance = Math.hypot(l - named.lab[0], a - named.lab[1], b - named.lab[2]);
    if (distance < bestDistance) {
      best = named;
      bestDistance = distance;
    }
  }
  return best?.name ?? null;
}
