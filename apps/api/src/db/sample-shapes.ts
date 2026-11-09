import type { MakeupShape } from '@starter/shared';

// Sample makeup shapes for the seeded recipes, in MediaPipe's canonical face texture. Points are
// landmark numbers moved by dx, dy in UV (the texture is 1 wide; y grows downward). Strokes for one
// side are drawn on the face's right half (the image's left) and mirrored.

// Brow outline: the upper edge from the tail to the head, then the lower edge back to the tail.
const browUpper = [70, 63, 105, 66, 107] as const;
const browLower = [55, 65, 52, 53, 46] as const;

/** dy for each of the five points of one brow edge. */
type BrowEdge = readonly [number, number, number, number, number];

/** A filled brow moved from the landmarks' brow by dy per point (upper tail→head, lower head→tail). */
function brow(upperDy: BrowEdge, lowerDy: BrowEdge): MakeupShape {
  return {
    strokes: [
      {
        mirror: true,
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

// The shapes below come from the team's makeup area editor (#260), which builds them with the
// same functions as ⑫-5. Numbers are rounded to 4 decimal places.

// MediaPipe's face oval, clockwise from the top of the forehead.
const faceOval = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
  176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
] as const;
// The right eye's lid edges, from the outer corner over the upper lid and back under it.
const eyeOutline = [
  33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7,
] as const;
// The outer edge of the lips, clockwise from the right corner of the mouth.
const lipOuter = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
] as const;
// The inner edge of the lips, clockwise from the right corner of the mouth.
const lipInner = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
] as const;

// The eye outline pushed slightly outward, to keep shadow and liner off the eye.
const eyeOutlineMargin = [
  { at: 33, dx: -0.0028, dy: -0.0001 },
  { at: 246, dx: -0.0027, dy: -0.0005 },
  { at: 161, dx: -0.0026, dy: -0.0009 },
  { at: 160, dx: -0.0023, dy: -0.0016 },
  { at: 159, dx: -0.0003, dy: -0.0028 },
  { at: 158, dx: 0.0019, dy: -0.0021 },
  { at: 157, dx: 0.0026, dy: -0.001 },
  { at: 173, dx: 0.0028, dy: -0.0002 },
  { at: 133, dx: 0.0028, dy: 0.0003 },
  { at: 155, dx: 0.0027, dy: 0.0006 },
  { at: 154, dx: 0.0026, dy: 0.001 },
  { at: 153, dx: 0.0019, dy: 0.002 },
  { at: 145, dx: -0.0003, dy: 0.0028 },
  { at: 144, dx: -0.0023, dy: 0.0015 },
  { at: 163, dx: -0.0027, dy: 0.0006 },
  { at: 7, dx: -0.0028, dy: 0.0001 },
];

/** 狐メイク's base shadow: narrow and long toward the outer corner. */
export const foxEyeShape: MakeupShape = {
  strokes: [
    {
      mirror: true,
      fill: true,
      blur: 0.006,
      opacity: 0.85,
      points: [
        { at: 226, dx: -0.0035, dy: -0.0104 },
        { at: 226, dx: 0.0073, dy: 0.0117 },
        { at: 110, dx: 0.0034, dy: 0.0013 },
        { at: 23, dx: -0.0015, dy: -0.0053 },
        { at: 25, dx: 0.0044, dy: -0.0054 },
        { at: 33, dy: -0.006 },
        { at: 161, dy: -0.004 },
        { at: 159, dy: -0.004 },
        { at: 157, dy: -0.004 },
        { at: 173, dx: 0.004 },
        { at: 56, dx: 0.0078, dy: 0.0068 },
        { at: 56, dx: -0.008, dy: -0.004 },
        { at: 28, dy: -0.006 },
        { at: 27, dy: -0.016 },
        { at: 224, dx: 0.0101, dy: -0.0033 },
        { at: 225, dx: 0.0035, dy: -0.0087 },
        { at: 113, dx: -0.0057, dy: -0.0055 },
      ],
    },
  ],
};

/** 狐メイク's deeper shadow on the outer half of the upper lid. */
export const foxEyeOuterShape: MakeupShape = {
  strokes: [
    {
      mirror: true,
      fill: true,
      blur: 0.013,
      opacity: 1,
      points: [
        { at: 160, dx: 0.0011, dy: -0.0037 },
        { at: 161, dx: -0.0067, dy: -0.0004 },
        { at: 33, dx: -0.0066, dy: -0.0022 },
        { at: 113, dx: -0.0063, dy: 0.0081 },
        { at: 113, dx: 0.0107, dy: -0.0039 },
        { at: 225, dx: 0.0065, dy: 0.007 },
        { at: 29, dx: -0.0066, dy: -0.011 },
        { at: 29, dx: 0.0101, dy: -0.0063 },
        { at: 27, dx: 0.006, dy: 0.002 },
        { at: 158, dx: 0.0118, dy: 0.0004 },
      ],
    },
    { erase: true, mirror: true, fill: true, points: eyeOutlineMargin },
  ],
};

/** 狐メイク's highlight: from the iris's outer edge to the outer corner, and a dot at the inner corner. */
export const foxHighlightShape: MakeupShape = {
  strokes: [
    {
      mirror: true,
      width: 0.0098,
      blur: 0.018,
      points: [
        { at: 339, dx: 0.0036, dy: -0.0056 },
        { at: 254, dx: -0.01, dy: -0.002 },
        { at: 252, dx: 0.0101, dy: -0.0011 },
      ],
    },
    {
      mirror: true,
      width: 0.02,
      blur: 0.015,
      opacity: 0.9,
      points: [
        { at: 463, dx: -0.0003, dy: -0.0097 },
        { at: 463, dx: -0.0019, dy: 0.0008 },
      ],
    },
  ],
};

/** 狐メイク's liner: thicker from the iris's outer edge toward the wing. */
export const foxLinerShape: MakeupShape = {
  strokes: [
    {
      mirror: true,
      width: 0.004,
      blur: 0.002,
      points: [
        { at: 173 },
        { at: 157 },
        { at: 158 },
        { at: 159 },
        { at: 160, dx: 0.0001, dy: -0.0008 },
      ],
    },
    {
      mirror: true,
      width: 0.008,
      blur: 0.002,
      points: [
        { at: 159 },
        { at: 160 },
        { at: 161, dx: 0.0015, dy: -0.0019 },
        { at: 246, dx: 0.0006, dy: -0.0046 },
        { at: 247, dx: 0.0012, dy: 0.0041 },
        { at: 113, dx: -0.0093, dy: 0.0088 },
      ],
    },
  ],
};

/** 狐メイク's shading: along the hollows under the bones. */
export const foxShadingShape: MakeupShape = {
  strokes: [
    {
      mirror: true,
      width: 0.035,
      blur: 0.028,
      opacity: 0.8,
      points: [
        { at: 103, dx: 0.01 },
        { at: 54, dx: 0.015 },
        { at: 21, dx: 0.02 },
      ],
    },
    {
      mirror: true,
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
      mirror: true,
      width: 0.04,
      blur: 0.022,
      opacity: 0.7,
      points: [
        { at: 172, dx: 0.015, dy: -0.01 },
        { at: 136, dy: -0.012 },
        { at: 150, dy: -0.012 },
      ],
    },
    {
      mirror: true,
      width: 0.018,
      blur: 0.014,
      opacity: 0.9,
      points: [
        { at: 141, dx: -0.0029, dy: -0.0055 },
        { at: 237, dx: 0.0004, dy: -0.0066 },
      ],
    },
  ],
};

/** 狐メイク's cheek: diagonally up toward the temple. */
export const foxCheekShape: MakeupShape = {
  strokes: [
    {
      mirror: true,
      fill: true,
      blur: 0.03,
      opacity: 0.85,
      points: [
        { at: 50, dx: 0.027, dy: -0.019 },
        { at: 229, dx: 0.0079, dy: 0.02 },
        { at: 228, dx: 0.004, dy: 0.0064 },
        { at: 31, dx: -0.019, dy: -0.0001 },
        { at: 143, dx: -0.0175, dy: 0.0029 },
        { at: 227, dx: 0.0307, dy: 0.0147 },
        { at: 123, dx: 0.0377, dy: -0.0051 },
      ],
    },
  ],
};

/** 狐メイク's waterline liner that makes the eye look like a parallelogram. */
export const foxInnerLinerShape: MakeupShape = {
  strokes: [
    {
      mirror: true,
      width: 0.005,
      blur: 0.006,
      opacity: 0.9,
      points: [
        { at: 130, dx: -0.0064, dy: 0.0092 },
        { at: 163, dx: 0.0041, dy: 0.0084 },
        { at: 145, dx: 0.0103, dy: -0.0006 },
      ],
    },
  ],
};

/** 猫メイク's shadow: the dark color only past the outer corner. */
export const catEyeShape: MakeupShape = {
  strokes: [
    {
      mirror: true,
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

/** 猫メイク's liner: a long wing from the outer corner. */
export const catLinerShape: MakeupShape = {
  strokes: [
    {
      mirror: true,
      width: 0.006,
      blur: 0.002,
      points: [
        { at: 173 },
        { at: 157 },
        { at: 159 },
        { at: 161, dx: 0.0055, dy: 0.0001 },
        { at: 33, dx: 0.0012, dy: -0.0016 },
        { at: 113, dx: -0.0095, dy: 0.0098 },
      ],
    },
  ],
};

/** 透明感の韓国風's base: thin from the center of the face, not on the eyes or the lips. */
export const koreanBaseShape: MakeupShape = {
  strokes: [
    { fill: true, blur: 0.05, opacity: 0.6, points: faceOval.map((at) => ({ at })) },
    { erase: true, mirror: true, fill: true, blur: 0.01, points: eyeOutline.map((at) => ({ at })) },
    { erase: true, fill: true, blur: 0.01, points: lipOuter.map((at) => ({ at })) },
  ],
};

/** 透明感の韓国風's highlight: the nose bridge and the high points of the cheeks. */
export const koreanHighlightShape: MakeupShape = {
  strokes: [
    {
      width: 0.018,
      blur: 0.012,
      opacity: 0.5,
      points: [{ at: 168 }, { at: 6 }, { at: 197 }, { at: 195 }],
    },
    { width: 0.03, blur: 0.02, opacity: 0.4, points: [{ at: 151, dy: 0.02 }, { at: 9 }] },
    {
      mirror: true,
      width: 0.03,
      blur: 0.02,
      opacity: 0.8,
      points: [{ at: 116, dx: 0.02 }, { at: 117 }, { at: 118 }],
    },
  ],
};

/** 透明感の韓国風's cheek: round on the middle of the cheeks. */
export const koreanCheekShape: MakeupShape = {
  strokes: [
    {
      mirror: true,
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

/** 透明感の韓国風's lip: deep inside, blurred outward. */
export const koreanLipShape: MakeupShape = {
  strokes: [
    { fill: true, blur: 0.012, opacity: 0.55, points: lipOuter.map((at) => ({ at })) },
    { width: 0.025, blur: 0.012, opacity: 0.6, points: [...lipInner, 78].map((at) => ({ at })) },
    { erase: true, fill: true, blur: 0.004, points: lipInner.map((at) => ({ at })) },
  ],
};

/** 面長メイク's highlight: a little below the nose root and above the nose tip, to shorten the midface. */
export const longHighlightShape: MakeupShape = {
  strokes: [
    {
      width: 0.0191,
      blur: 0.004,
      points: [
        { at: 168, dx: -0.0023, dy: 0.0166 },
        { at: 197, dx: -0.0001, dy: 0.0151 },
      ],
    },
    {
      width: 0.025,
      blur: 0.006,
      opacity: 0.9,
      points: [
        { at: 5, dx: 0.0041, dy: 0.0087 },
        { at: 4, dx: 0.0042, dy: -0.0059 },
      ],
    },
    {
      fill: true,
      blur: 0.006,
      opacity: 0.9,
      points: [
        { at: 83, dx: -0.0048, dy: 0.0153 },
        { at: 313, dx: 0.0152, dy: 0.0156 },
        { at: 200, dx: 0.0066, dy: 0.0133 },
      ],
    },
    {
      mirror: true,
      width: 0.025,
      blur: 0.02,
      opacity: 0.9,
      points: [
        { at: 346, dx: -0.0044, dy: -0.0134 },
        { at: 280, dx: 0.0061, dy: -0.0166 },
      ],
    },
    {
      mirror: true,
      width: 0.025,
      blur: 0.01,
      opacity: 0.9,
      points: [
        { at: 273, dx: -0.0137, dy: 0.0085 },
        { at: 287, dx: -0.0011, dy: 0.0165 },
        { at: 432, dx: -0.0016, dy: -0.0036 },
      ],
    },
    {
      width: 0.02,
      blur: 0.021,
      opacity: 0.9,
      points: [
        { at: 107, dx: -0.001, dy: -0.0261 },
        { at: 336, dx: -0.0039, dy: -0.0267 },
      ],
    },
  ],
};

/** 面長メイク's shading: from below so the chin looks pointed. */
export const longShadingShape: MakeupShape = {
  strokes: [
    {
      mirror: true,
      width: 0.0168,
      blur: 0.008,
      opacity: 0.9,
      points: [
        { at: 417, dx: 0.0095, dy: 0.0043 },
        { at: 441, dx: -0.0149, dy: -0.0078 },
      ],
    },
    {
      mirror: true,
      width: 0.016,
      blur: 0.006,
      opacity: 0.9,
      points: [
        { at: 44, dx: -0.0049, dy: 0.0026 },
        { at: 19, dx: -0.0046, dy: 0.0076 },
      ],
    },
    {
      mirror: true,
      fill: true,
      blur: 0.006,
      opacity: 0.9,
      points: [
        { at: 148, dx: -0.0171, dy: -0.0139 },
        { at: 170, dx: 0.0154, dy: -0.001 },
        { at: 136, dx: 0.0166, dy: 0.0242 },
      ],
    },
  ],
};

/** 面長メイク's cheek: under the eyes, spread outward. */
export const longCheekShape: MakeupShape = {
  strokes: [
    {
      mirror: true,
      fill: true,
      blur: 0.039,
      points: [
        { at: 175, dx: -0.0268, dy: -0.0145 },
        { at: 175, dx: 0.0021, dy: -0.0085 },
        { at: 175, dx: 0.0231, dy: -0.0072 },
        { at: 396, dx: 0.0011, dy: -0.004 },
        { at: 369, dx: -0.0039, dy: 0.0211 },
        { at: 377, dx: 0.0203, dy: -0.0112 },
        { at: 377, dx: -0.0234, dy: 0.0029 },
        { at: 152, dx: 0.0036, dy: -0.0054 },
        { at: 148, dx: 0.0325, dy: 0.0006 },
        { at: 148, dx: -0.0033, dy: -0.0111 },
        { at: 176, dx: 0.0247, dy: -0.0129 },
        { at: 171, dx: 0.0011, dy: -0.0061 },
      ],
    },
    {
      mirror: true,
      fill: true,
      blur: 0,
      opacity: 0.9,
      points: [
        { at: 117, dx: -0.0004, dy: 0.0015 },
        { at: 116, dx: -0.0284, dy: 0.0229 },
        { at: 34, dx: 0.0095, dy: 0.0287 },
        { at: 143, dx: 0.0075, dy: -0.0239 },
        { at: 226, dx: -0.0049, dy: 0.0134 },
        { at: 110, dx: 0.0039, dy: 0.0021 },
      ],
    },
  ],
};

/** 面長メイク's liner: from past the iris, extended at the same angle. */
export const longLinerShape: MakeupShape = {
  strokes: [
    {
      mirror: true,
      width: 0.006,
      blur: 0.004,
      points: [
        { at: 226, dx: -0.0103, dy: -0.0018 },
        { at: 130, dx: -0.0032, dy: -0.0024 },
        { at: 246, dx: 0.0028, dy: -0.0038 },
        { at: 160, dx: -0.0026, dy: 0.0001 },
        { at: 159 },
        { at: 158 },
        { at: 157 },
        { at: 173 },
        { at: 133 },
      ],
    },
    { erase: true, mirror: true, fill: true, points: eyeOutline.map((at) => ({ at })) },
  ],
};

/** 面長メイク's brown line from the iris's outer edge toward the liner's tip. */
export const longLinerShadowShape: MakeupShape = {
  strokes: [
    {
      mirror: true,
      width: 0.006,
      blur: 0.006,
      opacity: 0.9,
      points: [
        { at: 130, dx: -0.0085, dy: 0.0124 },
        { at: 163, dx: 0.0058, dy: 0.009 },
      ],
    },
    {
      mirror: true,
      width: 0.004,
      blur: 0.006,
      opacity: 0.9,
      points: [
        { at: 229, dx: -0.0135, dy: -0.008 },
        { at: 230, dx: -0.014, dy: -0.0016 },
        { at: 231, dx: -0.0117, dy: -0.0042 },
      ],
    },
  ],
};

/** 面長メイク's shadow on the lower lid. */
export const longEyeShape: MakeupShape = {
  strokes: [
    {
      mirror: true,
      width: 0.0167,
      blur: 0.004,
      points: [
        { at: 226, dx: 0.0007, dy: 0.0146 },
        { at: 31, dx: 0.0063, dy: -0.0153 },
        { at: 25, dx: -0.0072, dy: 0.0099 },
        { at: 110, dx: -0.0075, dy: 0.0047 },
        { at: 24, dx: -0.0117, dy: 0.0015 },
        { at: 24, dx: 0.0109, dy: 0.0049 },
        { at: 23, dx: 0.0075, dy: 0.0001 },
        { at: 154, dx: 0.0027, dy: -0.0004 },
      ],
    },
    { erase: true, mirror: true, fill: true, points: eyeOutlineMargin },
  ],
};
