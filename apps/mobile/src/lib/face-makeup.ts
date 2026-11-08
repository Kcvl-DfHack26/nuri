import type { MakeupShape, makeupParts } from '@starter/shared';

import { postedRecipeIdPrefix } from '@starter/shared';

type PartId = (typeof makeupParts)[number];

/**
 * One part painted over the face in a color, in the step's shape (`makeupShapeSchema`) or, without
 * one, the part's standard texture.
 */
export type MakeupLayer = { part: PartId; color: string; shape?: MakeupShape | null | undefined };

/** The middle of a step's recommended colors, e.g. a shadow's mid tone. */
export function paintColor(colors: readonly string[]) {
  return colors[Math.floor(colors.length / 2)] ?? '#000000';
}

/**
 * The layers a recipe paints. A posted recipe (#156) paints only the areas read from its video; the
 * standard textures would show areas the poster never painted.
 */
export function recipeLayers(recipeId: string, layers: MakeupLayer[]): MakeupLayer[] {
  return recipeId.startsWith(postedRecipeIdPrefix) ? layers.filter((layer) => layer.shape) : layers;
}
