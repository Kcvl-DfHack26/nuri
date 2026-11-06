import type { createApp } from './app';

// The mobile app may import this type-only entry; no server runtime code is exported.
export type AppType = ReturnType<typeof createApp>;
