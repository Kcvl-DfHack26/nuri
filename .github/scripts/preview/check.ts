import { checkExpoWeb, getProbe } from '../check-expo-web';

async function retryProbe<T>(probe: () => Promise<T>): Promise<T> {
  for (let retries = 5; ; retries -= 1) {
    try {
      return await probe();
    } catch (error) {
      if (retries === 0) {
        throw error;
      }
      await Bun.sleep(3000);
    }
  }
}

export async function checkCloudPreview(endpoint: string, origin: string) {
  await retryProbe(async () => {
    await (await getProbe(`${endpoint}/ready`)).arrayBuffer();
  });
  await checkExpoWeb(endpoint);

  const recipes: unknown = await (await getProbe(`${endpoint}/api/recipes?offset=0`)).json();
  if (
    !recipes ||
    typeof recipes !== 'object' ||
    !('items' in recipes) ||
    !Array.isArray(recipes.items) ||
    recipes.items.length === 0
  ) {
    throw new Error('Preview recipe feed is empty');
  }

  const qrCode = await (await getProbe(`${endpoint}/expo-go/qr.svg`)).text();
  if (!qrCode.includes('<svg')) {
    throw new Error('Preview Expo Go QR code is not SVG');
  }

  for (const platform of ['ios', 'android']) {
    const response = await retryProbe(() =>
      getProbe(`${endpoint}/`, {
        'Expo-Platform': platform,
        Accept: 'application/expo+json',
      }),
    );
    const manifest: unknown = await response.json();
    const launchAsset =
      manifest && typeof manifest === 'object' && 'launchAsset' in manifest
        ? manifest.launchAsset
        : null;
    if (
      !launchAsset ||
      typeof launchAsset !== 'object' ||
      !('url' in launchAsset) ||
      typeof launchAsset.url !== 'string' ||
      !launchAsset.url.startsWith(`${origin}/`)
    ) {
      throw new Error(`Expo Go ${platform} launch asset does not use the public preview origin`);
    }
  }
}
