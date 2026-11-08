function fetchProbe(url: string, headers?: HeadersInit) {
  return fetch(url, {
    ...(headers ? { headers } : {}),
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  });
}

export async function getProbe(url: string, headers?: HeadersInit) {
  const response = await fetchProbe(url, headers);
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response;
}

export async function checkExpoWeb(url: string) {
  const origin = url.replace(/\/$/, '');
  const html = await (await getProbe(`${origin}/`)).text();
  const assets = [...html.matchAll(/src="(\/_expo\/static\/[^"]+\.js)"/g)];
  const assetPath = assets.at(-1)?.[1];
  if (!assetPath) {
    throw new Error('Expo JavaScript asset is missing from the home page');
  }

  const recipeSteps = await (await getProbe(`${origin}/recipes/fox/steps`)).text();
  if (recipeSteps !== html) {
    throw new Error('Expo deep link did not return the home document');
  }

  const asset = await getProbe(`${origin}${assetPath}`);
  const contentType = asset.headers.get('content-type');
  if (!contentType?.includes('javascript')) {
    throw new Error(`Unexpected Expo JavaScript content type: ${contentType}`);
  }
  await asset.arrayBuffer();

  const capabilities: unknown = await (await getProbe(`${origin}/api/auth-capabilities`)).json();
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
    throw new Error('Expected an auth capabilities object');
  }

  for (const path of ['/api/nonexistent-web-probe', '/_expo/static/missing.js', '/about/']) {
    const response = await fetchProbe(`${origin}${path}`);
    await response.body?.cancel();
    if (response.status !== 404) {
      throw new Error(`${path} returned ${response.status}; expected 404`);
    }
  }
  console.log(`Expo Web routes and assets available at ${origin}`);
}

if (import.meta.main) {
  const url = Bun.argv[2];
  if (!url) {
    throw new Error('Usage: bun .github/scripts/check-expo-web.ts URL');
  }
  await checkExpoWeb(url);
}
