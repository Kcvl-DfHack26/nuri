import { router } from 'expo-router';

// Screens opened from a deep link have no history; fall back to the make home.
export function backOrHome() {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/');
}
