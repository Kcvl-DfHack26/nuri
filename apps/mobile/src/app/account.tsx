import { Button, Column, TextInput } from '@expo/ui';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { NativeHost } from '@/components/native-host';
import { apiUrl, authClient } from '@/lib/api';
import { colors } from '@/theme/colors';

function ConnectedAccount() {
  const { data: session, isPending, error: sessionError, refetch } = authClient.useSession();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const result =
        mode === 'signup'
          ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
          : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(result.error.message ?? 'Unable to sign in. Please try again.');
      } else {
        await refetch();
      }
    } catch {
      setError('Unable to connect. Your details are still here; please try again.');
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError(result.error.message ?? 'Unable to sign out. Please try again.');
      } else {
        await refetch();
      }
    } catch {
      setError('Unable to sign out. Please try again.');
    } finally {
      setPending(false);
    }
  }

  const signingUp = mode === 'signup';
  const heading = signingUp ? 'Make yourself at home.' : 'Welcome back.';
  const submitLabel = pending ? 'Please wait…' : signingUp ? 'Create account' : 'Sign in';
  const canSubmit =
    email.trim().length > 0 &&
    password.length >= (signingUp ? 12 : 1) &&
    (!signingUp || name.trim().length > 0);

  if (isPending) {
    return <ActivityIndicator accessibilityLabel="Loading your account" style={{ padding: 32 }} />;
  }
  return (
    <View style={{ gap: 20 }}>
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: '600' }}>
        {session ? `Hello, ${session.user.name}` : heading}
      </Text>
      {session ? (
        <>
          <Text selectable style={{ color: colors.secondary, fontSize: 17 }}>
            {session.user.email}
          </Text>
          <NativeHost matchContents>
            <Button
              label={pending ? 'Signing out…' : 'Sign out'}
              disabled={pending}
              onPress={() => {
                void signOut();
              }}
            />
          </NativeHost>
        </>
      ) : (
        <>
          <Text style={{ color: colors.secondary, fontSize: 16, lineHeight: 24 }}>
            Your rituals stay on this device. Your account is a place to begin.
          </Text>
          <NativeHost matchContents>
            <Column spacing={20}>
              {mode === 'signup' ? (
                <TextInput
                  accessibilityLabel="Your name"
                  placeholder="Your name"
                  onChangeText={setName}
                  autoComplete="name"
                  testID="account-name"
                />
              ) : null}
              <TextInput
                accessibilityLabel="Email"
                placeholder="Email"
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                testID="account-email"
              />
              <TextInput
                accessibilityLabel="Password"
                placeholder={mode === 'signup' ? 'Password · at least 12 characters' : 'Password'}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                testID="account-password"
              />
              <Button
                label={submitLabel}
                disabled={pending || !canSubmit}
                onPress={() => {
                  void submit();
                }}
                testID="submit-account"
              />
              <Button
                variant="text"
                label={
                  mode === 'signup'
                    ? 'Already have an account? Sign in'
                    : 'New here? Create an account'
                }
                disabled={pending}
                onPress={() => {
                  setMode(mode === 'signup' ? 'signin' : 'signup');
                  setError(null);
                }}
              />
            </Column>
          </NativeHost>
        </>
      )}
      {error || sessionError ? (
        <Text accessibilityRole="alert" style={{ color: colors.text, fontSize: 16 }}>
          {error ?? 'Unable to load your account. You can try signing in again.'}
        </Text>
      ) : null}
    </View>
  );
}

export default function AccountScreen() {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 24, paddingBottom: 48, gap: 24 }}
    >
      {apiUrl ? (
        <ConnectedAccount />
      ) : (
        <>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '600' }}>
            Enjoy a little offline time.
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 17, lineHeight: 26 }}>
            Sign-in isn’t available in this preview. You can still explore every ritual, save your
            favorites, and build your daily rhythm.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
