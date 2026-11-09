import { makeupShapeSchema } from '@starter/shared';
import { expect, test } from 'bun:test';

import * as sampleShapes from './sample-shapes';

test('every sample shape is a valid makeup shape', () => {
  const { browShapes, ...shapes } = sampleShapes;
  expect(Object.keys(shapes)).toHaveLength(19);
  for (const shape of [...Object.values(browShapes), ...Object.values(shapes)]) {
    expect(makeupShapeSchema.safeParse(shape).success).toBe(true);
  }
});
