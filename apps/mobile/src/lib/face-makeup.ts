import type { makeupParts } from '@starter/shared';

type PartId = (typeof makeupParts)[number];

/** One part painted over the face in a color. */
export type MakeupLayer = { part: PartId; color: string };

// Draw the skin first so line work and brows stay on top.
const paintOrder: readonly PartId[] = [
  'base',
  'shading',
  'highlight',
  'cheek',
  'eye',
  'lip',
  'lash',
  'brow',
];

/** The middle of a step's recommended colors, e.g. a shadow's mid tone. */
export function paintColor(colors: readonly string[]) {
  return colors[Math.floor(colors.length / 2)] ?? '#000000';
}

/** Finish layers in paint order, keeping the last step's color for each part. */
export function finishLayers(steps: readonly { part: PartId; colors: readonly string[] }[]) {
  const colorsByPart = new Map(steps.map((step) => [step.part, paintColor(step.colors)]));
  return paintOrder.flatMap((part) => {
    const color = colorsByPart.get(part);
    return color === undefined ? [] : [{ part, color }];
  });
}
