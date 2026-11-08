import { makeupShapeSchema } from '@starter/shared';
import { expect, test } from 'bun:test';

import { recipeTemplates, templateProductIds, templateRecipeIds } from './recipe-templates';

test('the twelve existing looks are complete and reference defined cosmetic types', () => {
  expect(templateRecipeIds).toEqual([
    'fox',
    'round',
    'cat',
    'long',
    'office',
    'korean',
    'brow-straight-flat',
    'brow-soft-arch',
    'brow-arch',
    'brow-straight',
    'brow-rising',
    'brow-falling',
  ]);
  expect(new Set(templateRecipeIds).size).toBe(12);
  expect(new Set(templateProductIds).size).toBe(templateProductIds.length);
  for (const look of recipeTemplates.slice(0, 6)) {
    for (const part of ['brow', 'eye', 'cheek', 'lip'] as const) {
      expect(look.steps.map((entry) => entry.part)).toContain(part);
    }
  }

  for (const template of recipeTemplates) {
    expect(template.products.length).toBeGreaterThan(0);
    expect(template.steps.length).toBeGreaterThan(0);
    for (const cosmetic of template.products) {
      expect(templateProductIds).toContain(cosmetic.productId);
      expect(cosmetic.usage.length).toBeGreaterThan(0);
    }
    for (const step of template.steps) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.hint.length).toBeGreaterThan(0);
      expect(step.product.length).toBeGreaterThan(0);
      expect(step.colors.length).toBeGreaterThan(0);
      for (const color of step.colors) {
        expect(color).toMatch(/^#[0-9A-F]{6}$/);
      }
      expect(makeupShapeSchema.safeParse(step.shape).success).toBe(true);
    }
  }
});
