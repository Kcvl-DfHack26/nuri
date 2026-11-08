import Constants from 'expo-constants';

export function OpenNativeAppLink({ recipeId }: { recipeId?: string }) {
  const configuredScheme = Constants.expoConfig?.scheme;
  const scheme = Array.isArray(configuredScheme) ? configuredScheme[0] : configuredScheme;
  if (!scheme) {
    return null;
  }
  // Target the make tab explicitly so the native app can switch to it from another tab.
  const path = recipeId ? `/recipes/${encodeURIComponent(recipeId)}` : '/(tabs)/(make)';

  return (
    <a
      className="border-line-soft bg-bg-surface text-ink-primary hover:bg-neutral-soft inline-flex min-h-12 items-center self-start rounded-full border px-3 font-maru-bold text-label no-underline"
      href={`${scheme}://${path}`}
    >
      アプリで開く
    </a>
  );
}
