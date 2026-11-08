import type { MakeupShape } from '@starter/shared';

// Sample makeup shapes for the seeded recipes, in MediaPipe's canonical face texture. Points are
// landmark numbers moved by dx, dy in UV (the texture is 1 wide; y grows downward). They are drawn
// on the face's right half (the image's left) and mirrored.

// Brow outline: the upper edge from the tail to the head, then the lower edge back to the tail.
const browUpper = [70, 63, 105, 66, 107] as const;
const browLower = [55, 65, 52, 53, 46] as const;

/** A filled brow moved from the landmarks' brow by dy per point (upper tail→head, lower head→tail). */
function brow(upperDy: readonly number[], lowerDy: readonly number[]): MakeupShape {
  return {
    mirror: true,
    strokes: [
      {
        fill: true,
        blur: 0.006,
        opacity: 0.9,
        points: [
          ...browUpper.map((at, index) => ({ at, dy: upperDy[index] ?? 0 })),
          ...browLower.map((at, index) => ({ at, dy: lowerDy[index] ?? 0 })),
        ],
      },
    ],
  };
}

export const browShapes = {
  /** 微アーチ眉: a slightly raised peak, the tail not below the head. */
  softArch: brow([-0.012, -0.006, -0.006, -0.002, 0], [0, -0.002, -0.004, -0.004, -0.01]),
  /** 平行眉: no peak, the head and the tail at one height. */
  flat: brow([-0.028, -0.01, 0.001, 0.002, 0], [-0.005, 0.003, 0.001, -0.005, -0.016]),
  /** アーチ眉: a rounded arch from the head over the peak, the tail thin and low. */
  arch: brow([0.006, -0.012, -0.016, -0.008, 0], [0, -0.004, -0.01, -0.006, 0.004]),
  /** ストレート眉: one straight line from the head to the tail. */
  straight: brow([-0.02, -0.006, 0.002, 0.003, 0], [-0.004, 0.003, 0.004, -0.002, -0.012]),
  /** 上がり眉: rising toward the tail, the peak far out. */
  rising: brow([-0.066, -0.03, -0.012, -0.002, 0], [-0.002, -0.006, -0.016, -0.028, -0.056]),
  /** 下がり眉: the tail a little below the head. */
  falling: brow([0.014, 0, 0.002, 0.002, 0], [0, 0.002, 0.004, 0.008, 0.016]),
} satisfies Record<string, MakeupShape>;

/** 狐メイク's shadow: from the outer corner, long and horizontal toward the temple. */
export const foxEyeShape: MakeupShape = {
  mirror: true,
  strokes: [
    {
      fill: true,
      blur: 0.012,
      opacity: 0.85,
      points: [
        { at: 130, dx: -0.028, dy: -0.008 },
        { at: 33, dy: -0.006 },
        { at: 161, dy: -0.004 },
        { at: 159, dy: -0.004 },
        { at: 157, dy: -0.004 },
        { at: 173, dy: -0.004 },
        { at: 190, dy: -0.008 },
        { at: 56, dy: -0.012 },
        { at: 28, dy: -0.014 },
        { at: 27, dy: -0.016 },
        { at: 29, dy: -0.016 },
        { at: 30, dy: -0.014 },
        { at: 113, dx: -0.012, dy: -0.002 },
      ],
    },
  ],
};

/** 狐メイク's liner: along the lashes, thicker toward the outer corner, winged up. */
export const foxLinerShape: MakeupShape = {
  mirror: true,
  strokes: [
    {
      width: 0.004,
      blur: 0.002,
      points: [{ at: 173 }, { at: 157 }, { at: 158 }, { at: 159 }, { at: 160 }],
    },
    {
      width: 0.008,
      blur: 0.002,
      points: [
        { at: 159 },
        { at: 160 },
        { at: 161 },
        { at: 246 },
        { at: 33 },
        { at: 130, dx: -0.03, dy: -0.018 },
      ],
    },
  ],
};

/** 狐メイク's shading: the temples, the sides of the face and the jaw. */
export const foxShadingShape: MakeupShape = {
  mirror: true,
  strokes: [
    {
      width: 0.035,
      blur: 0.02,
      opacity: 0.8,
      points: [
        { at: 103, dx: 0.01 },
        { at: 54, dx: 0.015 },
        { at: 21, dx: 0.02 },
      ],
    },
    {
      width: 0.04,
      blur: 0.02,
      opacity: 0.8,
      points: [
        { at: 127, dx: 0.02 },
        { at: 234, dx: 0.025 },
        { at: 93, dx: 0.025 },
      ],
    },
    {
      width: 0.04,
      blur: 0.022,
      opacity: 0.7,
      points: [
        { at: 172, dx: 0.015, dy: -0.01 },
        { at: 136, dy: -0.012 },
        { at: 150, dy: -0.012 },
      ],
    },
  ],
};

/** 狐メイク's cheek: from the cheekbone diagonally up toward the temple. */
export const foxCheekShape: MakeupShape = {
  mirror: true,
  strokes: [
    {
      fill: true,
      blur: 0.03,
      opacity: 0.85,
      points: [
        { at: 205, dy: -0.012 },
        { at: 101 },
        { at: 118 },
        { at: 111, dx: -0.01 },
        { at: 116, dx: -0.02 },
        { at: 123 },
        { at: 50 },
      ],
    },
  ],
};

// MediaPipe's face oval, clockwise from the top of the forehead.
const faceOval = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
  176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
] as const;
// The outer edge of the lips, clockwise from the right corner of the mouth.
const lipOuter = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
] as const;
// The inner edge of the lips, clockwise from the right corner of the mouth.
const lipInner = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
] as const;

/** 透明感の韓国風's base: the whole face, sheer and soft at the edges. */
export const koreanBaseShape: MakeupShape = {
  mirror: false,
  strokes: [{ fill: true, blur: 0.05, opacity: 0.6, points: faceOval.map((at) => ({ at })) }],
};

/** 透明感の韓国風's highlight: the nose bridge, the middle of the forehead and the cheekbones. */
export const koreanHighlightShape: MakeupShape = {
  mirror: true,
  strokes: [
    {
      width: 0.018,
      blur: 0.012,
      opacity: 0.5,
      points: [{ at: 168 }, { at: 6 }, { at: 197 }, { at: 195 }],
    },
    { width: 0.03, blur: 0.02, opacity: 0.4, points: [{ at: 151, dy: 0.02 }, { at: 9 }] },
    {
      width: 0.03,
      blur: 0.02,
      opacity: 0.8,
      points: [{ at: 116, dx: 0.02 }, { at: 117 }, { at: 118 }],
    },
  ],
};

/** 透明感の韓国風's cheek: a round flush on the apples of the cheeks. */
export const koreanCheekShape: MakeupShape = {
  mirror: true,
  strokes: [
    {
      fill: true,
      blur: 0.035,
      opacity: 0.7,
      points: [
        { at: 50 },
        { at: 101 },
        { at: 118 },
        { at: 117 },
        { at: 123 },
        { at: 147 },
        { at: 187 },
        { at: 205 },
      ],
    },
  ],
};

/** 透明感の韓国風's lip: a gradient lip, deepest just inside. */
export const koreanLipShape: MakeupShape = {
  mirror: false,
  strokes: [
    { fill: true, blur: 0.012, opacity: 0.55, points: lipOuter.map((at) => ({ at })) },
    { fill: true, blur: 0.01, opacity: 0.8, points: lipInner.map((at) => ({ at })) },
  ],
};

/** 猫メイク's shadow: the outer third, pulled out and slightly down. */
export const catEyeShape: MakeupShape = {
  mirror: true,
  strokes: [
    {
      fill: true,
      blur: 0.012,
      opacity: 0.85,
      points: [
        { at: 130, dx: -0.024, dy: 0.006 },
        { at: 33, dy: -0.004 },
        { at: 161, dy: -0.004 },
        { at: 160, dy: -0.006 },
        { at: 29, dy: -0.01 },
        { at: 30, dy: -0.012 },
        { at: 113, dx: -0.014, dy: 0.004 },
      ],
    },
  ],
};

/** 猫メイク's liner: a long, sharp wing past the outer corner. */
export const catLinerShape: MakeupShape = {
  mirror: true,
  strokes: [
    {
      width: 0.006,
      blur: 0.002,
      points: [
        { at: 173 },
        { at: 157 },
        { at: 159 },
        { at: 161 },
        { at: 33 },
        { at: 130, dx: -0.045, dy: -0.024 },
      ],
    },
  ],
};
