import { expect, test } from 'bun:test';

import {
  analysisPrompt,
  answerSteps,
  clockSeconds,
  clockText,
  geminiJsonSchema,
  readVerification,
} from './gemini';

test('adds the marks to the instructions only when the user made them', () => {
  expect(analysisPrompt([])).not.toContain('手順を区切りました');
  expect(analysisPrompt([26, 62.5])).toContain('0:26.0，1:02.5');
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

test('reads m:ss times, past a minute too, and refuses other text', () => {
  expect(clockSeconds('0:05')).toBe(5);
  expect(clockSeconds('1:07')).toBe(67);
  expect(clockSeconds(' 12:30.5 ')).toBe(750.5);
  for (const text of ['107', '1:7', '1:60', '', 'abc', '-0:05']) {
    expect(clockSeconds(text)).toBeNull();
  }
});

test('writes seconds as m:ss for the instructions', () => {
  expect(clockText(5)).toBe('0:05.0');
  expect(clockText(62.5)).toBe('1:02.5');
  expect(clockText(600)).toBe('10:00.0');
});

test('turns the steps’ times into seconds and leaves out a step whose time cannot be read', () => {
  expect(
    answerSteps([
      { start: '0:58', end: '1:07', part: 'cheek', color: '#e8968a' },
      { start: '107', end: '115', part: 'shading', color: null },
    ]),
  ).toEqual([{ start: 58, end: 67, part: 'cheek', color: '#E8968A' }]);
  // A malformed color is unknown, not a failed answer.
  expect(answerSteps([{ start: '0:01', end: '0:05', color: '#000' }])[0]?.color).toBeNull();
  expect(answerSteps([{ start: '0:01', end: '0:05', color: null }])[0]?.color).toBeNull();
});
