import { z } from 'zod';

import { checkExpoWeb, getProbe } from '../check-expo-web';

const recipeFeed = z.object({ items: z.array(z.unknown()).min(1) });
const mediaImage = z.object({ image: z.string().startsWith('/media/') });
const seedRecipe = z.object({
  recipe: mediaImage.extend({
    author: mediaImage,
    products: z.tuple([mediaImage]).rest(z.unknown()),
  }),
});
const manifest = z.object({ launchAsset: z.object({ url: z.string() }) });
const runOrigin = z.string().regex(/^https:\/\/[a-z0-9.-]+\.run\.app$/);

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

async function checkCloudPreview(endpoint: string, origin: string) {
  await retryProbe(async () => {
    await (await getProbe(`${endpoint}/ready`)).arrayBuffer();
  });
  await checkExpoWeb(endpoint);

  recipeFeed.parse(await (await getProbe(`${endpoint}/api/recipes?offset=0`)).json());
  const { recipe } = seedRecipe.parse(await (await getProbe(`${endpoint}/api/recipes/fox`)).json());
  for (const { image } of [recipe, recipe.author, recipe.products[0]]) {
    const response = await getProbe(`${endpoint}${image}`);
    if (!response.headers.get('content-type')?.startsWith('image/')) {
      await response.body?.cancel();
      throw new Error('The preview media API did not return an image');
    }
    await response.arrayBuffer();
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
    const { launchAsset } = manifest.parse(await response.json());
    if (!launchAsset.url.startsWith(`${origin}/`)) {
      throw new Error(`Expo Go ${platform} launch asset does not use the public preview origin`);
    }
  }
}

if (import.meta.main) {
  const [endpoint, origin] = Bun.argv.slice(2);
  await checkCloudPreview(runOrigin.parse(endpoint), runOrigin.parse(origin));
}
