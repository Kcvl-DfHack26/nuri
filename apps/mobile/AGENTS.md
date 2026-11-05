# Mobile

Follow the root AGENTS.md. Expo SDK 58 and React Native 0.88 are pinned in the lockfile.

- iOS UX is the priority; **every feature must work on Android**. Use universal Expo UI and Native Tabs/Stack with SF Symbols and Material icons.
- Fetch SDK 58 docs and inspect installed types before using Expo APIs. `src/app` is routes-only.
- Use `bunx expo install` for native dependencies. Do not hand-edit generated `ios/` or `android/` folders.
- `bun run typecheck`, `bun run test`, `bun run doctor`, `bun run export` run here. Root `bun run lint` owns lint configuration.
- Prefer Expo Go for the first smoke test. EAS development builds are required for PR OTA previews and custom native configurations.
- Never put a secret in `EXPO_PUBLIC_*`. See ../../docs/setup.md for device networking and EAS setup.
