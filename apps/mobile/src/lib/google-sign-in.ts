import * as Linking from 'expo-linking';

import { authClient } from '@/lib/api';

export async function signInWithGoogle(emulated: boolean) {
  const result = await authClient.signIn.social({
    provider: emulated ? 'emulate-google' : 'google',
    callbackURL: Linking.createURL('/'),
  });
  if (result.error) {
    throw new Error('Google ログインを完了できませんでした。もう一度お試しください。');
  }
}
