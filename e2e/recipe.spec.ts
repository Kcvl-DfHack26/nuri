import { expect, test } from '@playwright/test';

const phone = { width: 390, height: 844 };
const tablet = { width: 1194, height: 834 };

for (const { name, viewport, firstRowCount } of [
  { name: 'phone', viewport: phone, firstRowCount: 2 },
  { name: 'landscape tablet', viewport: tablet, firstRowCount: 6 },
]) {
  test(`open a recipe, finish its steps and use comparison on a ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const cards = page.getByRole('button', { name: /、いいね/ });
    await expect(cards.nth(5)).toBeVisible();
    await expect
      .poll(() =>
        cards.evaluateAll((elements) => {
          const positions = elements.map((element) => element.getBoundingClientRect());
          return positions.filter(({ y }) => Math.abs(y - (positions[0]?.y ?? 0)) < 3).length;
        }),
      )
      .toBe(firstRowCount);

    await page.getByRole('button', { name: /狐メイク、mio、いいね/ }).click();
    await expect(page).toHaveURL('/recipes/fox');
    const start = page.getByRole('button', { name: 'メイクをはじめる', exact: true });
    await expect(start).toBeInViewport();
    if (viewport === tablet) {
      expect((await start.boundingBox())?.x).toBeGreaterThan(tablet.width * 0.48);
    }
    await start.click();
    await expect(page).toHaveURL('/recipes/fox/steps');

    // A shared link or refresh must boot the exported SPA on the same step screen.
    await page.reload();
    await expect(page.getByText('1/5', { exact: true })).toBeVisible();
    const next = page.getByRole('button', { name: '次へ', exact: true });
    await expect(next).toBeInViewport();
    if (viewport === tablet) {
      expect((await next.boundingBox())?.x).toBeGreaterThan(tablet.width * 0.58);
    }
    await next.click();
    await expect(page.getByText('2/5', { exact: true })).toBeVisible();
    await page.setViewportSize(viewport === tablet ? phone : tablet);
    await expect(page.getByText('2/5', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '5 チーク', exact: true }).click();
    await expect(page.getByText('5/5', { exact: true })).toBeVisible();
    await next.click();
    await expect(page).toHaveURL('/recipes/fox/finish');
    await expect(page.getByRole('heading', { name: 'Finish!' })).toBeVisible();

    // Comparison is available by URL. The finish screen currently has no link to it.
    await page.setViewportSize(tablet);
    await page.goto('/recipes/fox/compare');
    const handle = page.getByLabel('メイク前とメイク後の境目');
    await expect(handle).toBeVisible();
    const bounds = await handle.boundingBox();
    if (!bounds) {
      throw new Error('Comparison handle has no layout');
    }
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + 60, bounds.y + bounds.height / 2, {
      steps: 4,
    });
    await page.mouse.up();
    await expect
      .poll(async () => Math.round((await handle.boundingBox())?.x ?? 0))
      .toBeCloseTo(Math.round(bounds.x + 60), -1);
  });
}
