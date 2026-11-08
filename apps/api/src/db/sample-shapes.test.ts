import { makeupShapeSchema } from '@starter/shared';
import { expect, test } from 'bun:test';

import {
  browShapes,
  catEyeShape,
  catLinerShape,
  foxCheekShape,
  foxEyeShape,
  foxLinerShape,
  foxShadingShape,
  koreanBaseShape,
  koreanCheekShape,
  koreanHighlightShape,
  koreanLipShape,
} from './sample-shapes';

test('every sample shape is a valid makeup shape', () => {
  const shapes = [
    ...Object.values(browShapes),
    catEyeShape,
    catLinerShape,
    foxCheekShape,
    foxEyeShape,
    foxLinerShape,
    foxShadingShape,
    koreanBaseShape,
    koreanCheekShape,
    koreanHighlightShape,
    koreanLipShape,
  ];
  for (const shape of shapes) {
    expect(makeupShapeSchema.safeParse(shape).success).toBe(true);
  }
});
