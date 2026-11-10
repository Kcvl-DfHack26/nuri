import { expect, test } from '@playwright/test';

const phone = { width: 390, height: 844 };
const tablet = { width: 1194, height: 834 };

for (const { name, viewport, firstRowCount } of [
  { name: 'phone', viewport: phone, firstRowCount: 2 },
  { name: 'landscape tablet', viewport: tablet, firstRowCount: 6 },
]) {
  test(`open a recipe, finish its steps and use comparison on a ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const recipes = page.waitForResponse('**/api/recipes?offset=0');
    await page.goto('/');
    const response = await recipes;
    expect(response.ok()).toBe(true);
    expect(new URL(response.url()).origin).toBe(new URL(page.url()).origin);
    const openApp = page.getByRole('link', { name: 'アプリで開く', exact: true });
    await expect(openApp).toBeInViewport();
    await expect(openApp).toHaveAttribute('href', 'com.kcvl.nuri:///(tabs)/(make)');
    const cards = page.getByRole('button', { name: /、お気に入り/ });
    await expect(cards.nth(5)).toBeVisible();
    await expect
      .poll(() =>
        cards.evaluateAll((elements) => {
          const positions = elements.map((element) => element.getBoundingClientRect());
          return positions.filter(({ y }) => Math.abs(y - (positions[0]?.y ?? 0)) < 3).length;
        }),
      )
      .toBe(firstRowCount);

    await page.getByRole('button', { name: /狐メイク、mio、お気に入り/ }).click();
    await expect(page).toHaveURL('/recipes/fox');
    await expect(openApp).toBeInViewport();
    await expect(openApp).toHaveAttribute('href', 'com.kcvl.nuri:///recipes/fox');
    const start = page.getByRole('button', { name: 'メイクをはじめる', exact: true });
    await expect(start).toBeInViewport();
    if (viewport === tablet) {
      expect((await start.boundingBox())?.x).toBeGreaterThan(tablet.width * 0.48);
    }
    await start.click();
    await expect(page).toHaveURL('/recipes/fox/steps');

    // A shared link or refresh must boot the exported SPA on the same step screen.
    await page.reload();
    await expect(page.getByText('1/8', { exact: true })).toBeVisible();
    const next = page.getByRole('button', { name: '次へ', exact: true });
    await expect(next).toBeInViewport();
    if (viewport === tablet) {
      expect((await next.boundingBox())?.x).toBeGreaterThan(tablet.width * 0.58);
    }
    await next.click();
    await expect(page.getByText('2/8', { exact: true })).toBeVisible();
    await page.setViewportSize(viewport === tablet ? phone : tablet);
    await expect(page.getByText('2/8', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '8 チーク', exact: true }).click();
    await expect(page.getByText('8/8', { exact: true })).toBeVisible();
    await next.click();
    await expect(page).toHaveURL('/recipes/fox/finish');
    await expect(page.getByRole('heading', { name: 'Finish!' })).toBeVisible();

    // Comparison is available by URL. The finish screen currently has no link to it.
    await page.setViewportSize(tablet);
    await page.goto('/recipes/fox/compare');
    const handle = page.getByRole('slider', { name: 'メイク前とメイク後の境目' });
    await expect(handle).toBeVisible();
    // The preview initially spans the viewport. Wait for the tablet layout before measuring.
    await expect
      .poll(
        async () => {
          const box = await handle.boundingBox();
          if (!box) {
            return false;
          }
          const center = box.x + box.width / 2;
          return center > tablet.width / 5 && center < tablet.width / 2;
        },
        { message: 'The comparison handle starts near the center of the left pane' },
      )
      .toBe(true);
    const bounds = await handle.boundingBox();
    if (!bounds) {
      throw new Error('Comparison handle has no layout');
    }
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    try {
      await page.mouse.move(x + 60, y, { steps: 4 });
      await expect
        .poll(async () => Math.round((await handle.boundingBox())?.x ?? 0))
        .toBeCloseTo(Math.round(bounds.x + 60), -1);
    } finally {
      await page.mouse.up();
    }
  });
}
