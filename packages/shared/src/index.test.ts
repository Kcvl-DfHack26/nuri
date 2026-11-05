import { describe, expect, test } from 'bun:test';

import {
  catalogQuerySchema,
  filterRituals,
  preferencesSchema,
  ritualSchema,
  rituals,
} from './index';

describe('ritual catalog', () => {
  test('searches titles and categories without case or surrounding whitespace', () => {
    expect(filterRituals('  MOVEMENT ')).toHaveLength(1);
    expect(filterRituals('chapter')[0]?.id).toBe('read');
    expect(filterRituals('not in the catalog')).toEqual([]);
  });
  test('rejects unbounded search and invalid saved preferences', () => {
    expect(catalogQuerySchema.safeParse({ q: 'x'.repeat(101) }).success).toBe(false);
    expect(preferencesSchema.safeParse({ dailyGoal: 0 }).success).toBe(false);
    expect(preferencesSchema.parse({}).dailyGoal).toBe(3);
  });
  test('ships valid, uniquely addressable rituals', () => {
    expect(rituals.every((item) => ritualSchema.safeParse(item).success)).toBe(true);
    expect(new Set(rituals.map((item) => item.id)).size).toBe(rituals.length);
  });
});
