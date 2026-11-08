import { expect, test } from 'bun:test';

import { analysisPrompt, geminiJsonSchema, readVerification } from './gemini';

test('adds the marks to the instructions only when the user made them', () => {
  expect(analysisPrompt([])).not.toContain('手順を区切りました');
  expect(analysisPrompt([26, 62.5])).toContain('26.0秒，62.5秒');
});

test('reads whether search found the product, also inside a code fence', () => {
  expect(readVerification('{"found": true}')).toBe(true);
  expect(readVerification('```json\n{"found": false, "note": "x"}\n```')).toBe(false);
  expect(readVerification('見つかりませんでした')).toBeNull();
  expect(readVerification('{"found": "yes"}')).toBeNull();
  expect(readVerification(undefined)).toBeNull();
});

test('keeps only the schema keywords Vertex AI accepts', () => {
  expect(
    geminiJsonSchema({
      type: 'object',
      additionalProperties: false,
      required: ['steps'],
      properties: {
        steps: { type: 'array', maxItems: 20, items: { type: 'integer', minimum: 0, maximum: 9 } },
        part: { type: 'string', enum: ['brow'], maxLength: 40, description: '部位' },
      },
    }),
  ).toEqual({
    type: 'object',
    required: ['steps'],
    properties: {
      steps: { type: 'array', items: { type: 'integer' } },
      part: { type: 'string', enum: ['brow'], description: '部位' },
    },
  });
});
