import { queryOptions } from '@tanstack/react-query';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { authClient } from '@/lib/api';

export function passkeyListOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: ['passkeys', userId],
    enabled: Boolean(userId),
    queryFn: async ({ signal }) => {
      const result = await authClient.passkey.listUserPasskeys({ fetchOptions: { signal } });
      if (result.error) {
        throw new Error('パスキーを読み込めませんでした。');
      }
      return result.data;
    },
  });
}

export const passkeysAvailable =
  Platform.OS === 'web'
    ? typeof PublicKeyCredential !== 'undefined'
    : Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
      Boolean(process.env.EXPO_PUBLIC_PASSKEY_RP_ID);

export async function addPasskey() {
  if (Platform.OS === 'web') {
    const result = await authClient.passkey.addPasskey({ name: 'この端末' });
    if (result.error) {
      throw new Error('パスキーを登録できませんでした。もう一度お試しください。');
    }
    return;
  }
  const { Passkey } = await import('react-native-passkey');
  const options = await authClient.passkey.generateRegisterOptions({ query: { name: 'この端末' } });
  if (!options.data) {
    throw new Error('登録を開始できませんでした。ログインし直してください。');
  }
  const data = options.data;
  if (!data.rp.id) {
    throw new Error('パスキーの設定を確認してください。');
  }
  const response = await Passkey.create({
    challenge: data.challenge,
    rp: { id: data.rp.id, name: data.rp.name },
    user: data.user,
    pubKeyCredParams: data.pubKeyCredParams,
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    excludeCredentials: (data.excludeCredentials ?? []).map(({ id, type }) => ({ id, type })),
  });
  const result = await authClient.passkey.verifyRegistration({
    response: { ...response, type: 'public-key' },
    name: 'この端末',
  });
  if (result.error) {
    throw new Error('パスキーを登録できませんでした。もう一度お試しください。');
  }
}

export async function signInWithPasskey() {
  if (Platform.OS === 'web') {
    const result = await authClient.signIn.passkey();
    if (result.error) {
      throw new Error('ログインを完了できませんでした。別の方法もお試しください。');
    }
    return;
  }
  const { Passkey } = await import('react-native-passkey');
  const options = await authClient.passkey.generateAuthenticateOptions();
  if (!options.data?.rpId) {
    throw new Error('ログインを開始できませんでした。');
  }
  const response = await Passkey.get({
    challenge: options.data.challenge,
    rpId: options.data.rpId,
    userVerification: 'required',
  });
  const result = await authClient.passkey.verifyAuthentication({
    response: {
      id: response.id,
      rawId: response.rawId ?? response.id,
      type: 'public-key',
      response: response.response,
      clientExtensionResults: {},
    },
  });
  if (result.error) {
    throw new Error('ログインを完了できませんでした。別の方法もお試しください。');
  }
  await authClient.getSession({ fetchOptions: { throw: true } });
}
