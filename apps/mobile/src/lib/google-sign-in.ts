import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { authClient } from '@/lib/api';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();

export async function signInWithGoogle(emulated: boolean) {
  if (
    !emulated &&
    webClientId &&
    (Platform.OS === 'android' || (Platform.OS === 'ios' && iosClientId)) &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
  ) {
    let token: string | null | undefined;
    try {
      const { GoogleOneTapSignIn, isNoSavedCredentialFoundResponse, isSuccessResponse } =
        await import('react-native-nitro-google-signin');
      GoogleOneTapSignIn.configure({ webClientId, iosClientId: iosClientId ?? null });
      const saved = await GoogleOneTapSignIn.signIn();
      const credential = isNoSavedCredentialFoundResponse(saved)
        ? await GoogleOneTapSignIn.createAccount()
        : saved;
      if (!isSuccessResponse(credential)) {
        return;
      }
      token = credential.data.idToken;
    } catch {
      throw new Error('Google ログインを開始できませんでした。もう一度お試しください。');
    }
    if (token) {
      const result = await authClient.signIn.social({
        provider: 'google',
        idToken: { token },
      });
      if (!result.error) {
        return;
      }
    }
    throw new Error('Google ログインを完了できませんでした。もう一度お試しください。');
  }

  const result = await authClient.signIn.social({
    provider: emulated ? 'emulate-google' : 'google',
    callbackURL: Linking.createURL('/'),
  });
  if (result.error) {
    throw new Error('Google ログインを完了できませんでした。もう一度お試しください。');
  }
}
