import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    e2eCameraRequests: number;
    e2eCameraStream?: MediaStream;
  }
}

async function observeCamera(page: Page, delay = false) {
  await page.addInitScript((deferStream) => {
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.e2eCameraRequests = 0;
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      window.e2eCameraRequests += 1;
      const stream = await getUserMedia(constraints);
      window.e2eCameraStream = stream;
      if (deferStream) {
        await new Promise<void>((resolve) => {
          document.addEventListener(
            'release-e2e-camera',
            () => {
              resolve();
            },
            { once: true },
          );
        });
      }
      return stream;
    };
  }, delay);
}

async function expectCameraState(page: Page, state: MediaStreamTrackState) {
  await expect
    .poll(() =>
      page.evaluate(() => window.e2eCameraStream?.getTracks().map((track) => track.readyState)),
    )
    .toEqual([state]);
}

test('a denied camera request keeps the sample and the recipe usable', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException('Camera permission denied', 'NotAllowedError'));
  });
  await page.goto('/recipes/fox/steps');

  await page.getByRole('button', { name: 'カメラを使う', exact: true }).click();
  await expect(page.getByText(/カメラを開けませんでした/)).toBeVisible();
  await expect(page.getByLabel('カメラ映像', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'ガイドを隠す' })).toBeVisible();
  await page.getByRole('button', { name: '次へ', exact: true }).click();
  await expect(page.getByText('2/8', { exact: true })).toBeVisible();
});

test.describe('with a permitted virtual camera', () => {
  test.use({ permissions: ['camera'] });

  test('capture starts after opt-in and stops on sample return or navigation', async ({ page }) => {
    await observeCamera(page);
    await page.goto('/recipes/fox/steps');
    const start = page.getByRole('button', { name: 'カメラを使う', exact: true });
    const video = page.getByLabel('カメラ映像', { exact: true });
    await expect(start).toBeVisible();
    expect(await page.evaluate(() => window.e2eCameraRequests)).toBe(0);

    await start.click();
    await expect(video).toBeVisible();
    await expect
      .poll(() =>
        video.evaluate((node) => (node instanceof HTMLVideoElement ? node.videoWidth : 0)),
      )
      .toBeGreaterThan(0);
    expect(
      await page.evaluate(() => window.e2eCameraStream?.getTracks().map((track) => track.kind)),
    ).toEqual(['video']);
    await page.getByRole('button', { name: '見本に戻る', exact: true }).click();
    await expectCameraState(page, 'ended');
    await expect(video).toHaveCount(0);

    await start.click();
    await expect(video).toBeVisible();
    await expectCameraState(page, 'live');
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await expect(page).toHaveURL('/');
    await expectCameraState(page, 'ended');
  });

  test('a stream arriving after navigation is released', async ({ page }) => {
    await observeCamera(page, true);
    await page.goto('/recipes/fox/steps');
    await page.getByRole('button', { name: 'カメラを使う', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.e2eCameraStream?.getVideoTracks().length))
      .toBe(1);
    await expect(page.getByRole('button', { name: '許可を待っています' })).toBeDisabled();
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await expect(page).toHaveURL('/');
    await page.evaluate(() => {
      document.dispatchEvent(new Event('release-e2e-camera'));
    });
    await expectCameraState(page, 'ended');
  });
});
