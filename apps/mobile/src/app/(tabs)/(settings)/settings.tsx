import {
  Button,
  Column,
  FieldGroup,
  ListItem,
  Picker,
  Slider,
  Switch,
  Text as NativeText,
} from '@expo/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { NativeHost } from '@/components/native-host';
import { api, apiUrl } from '@/lib/api';
import { usePreferences } from '@/lib/preferences';
import { colors } from '@/theme/colors';

export default function SettingsScreen() {
  const { preferences, update, storageError } = usePreferences();
  const [connection, setConnection] = useState('Not checked');
  const [checking, setChecking] = useState(false);

  async function checkConnection() {
    if (!apiUrl) {
      return;
    }
    setChecking(true);
    setConnection('Checking…');
    try {
      const response = await api.api.rituals.$get(
        { query: { q: '' } },
        { init: { signal: AbortSignal.timeout(10000) } },
      );
      if (!response.ok) {
        throw new Error('Unavailable');
      }
      const data = await response.json();
      setConnection(`Connected · ${data.items.length} rituals available`);
    } catch {
      setConnection('Unable to connect. Check your connection and try again.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {storageError ? (
        <Text accessibilityRole="alert" style={{ color: colors.text, padding: 16 }}>
          {storageError}
        </Text>
      ) : null}
      <NativeHost style={{ flex: 1 }}>
        <FieldGroup>
          <FieldGroup.Section title="Make it yours">
            <ListItem>
              <NativeText>Appearance</NativeText>
              <ListItem.Trailing>
                <Picker
                  selectedValue={preferences.appearance}
                  onValueChange={(appearance) => {
                    update({ appearance });
                  }}
                  testID="appearance-picker"
                >
                  <Picker.Item label="System" value="system" />
                  <Picker.Item label="Light" value="light" />
                  <Picker.Item label="Dark" value="dark" />
                </Picker>
              </ListItem.Trailing>
            </ListItem>
            <Switch
              label="Haptic feedback"
              value={preferences.haptics}
              onValueChange={(haptics) => {
                update({ haptics });
              }}
              testID="haptics-switch"
            />
          </FieldGroup.Section>
          <FieldGroup.Section title="Your daily rhythm">
            <Column spacing={12} style={{ paddingVertical: 8 }}>
              <NativeText>{`${preferences.dailyGoal} rituals each day`}</NativeText>
              <Slider
                value={preferences.dailyGoal}
                min={1}
                max={5}
                step={1}
                onValueChange={(dailyGoal) => {
                  update({ dailyGoal });
                }}
                testID="daily-goal"
              />
            </Column>
            <FieldGroup.SectionFooter>
              <NativeText>A gentle intention, never a deadline.</NativeText>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>
          <FieldGroup.Section title="Account">
            <ListItem
              onPress={() => {
                router.push('/account');
              }}
              supportingText="Sign in or create an account"
              testID="open-account"
            >
              <NativeText>Your account</NativeText>
            </ListItem>
            <FieldGroup.SectionFooter>
              <NativeText>Your saved rituals and preferences stay on this device.</NativeText>
            </FieldGroup.SectionFooter>
          </FieldGroup.Section>
          <FieldGroup.Section title="Connection">
            <NativeText>
              {apiUrl
                ? connection
                : 'You’re using Daylight offline. All rituals are ready to explore.'}
            </NativeText>
            {apiUrl ? (
              <Button
                label={checking ? 'Checking…' : 'Check connection'}
                disabled={checking}
                variant="text"
                onPress={() => {
                  void checkConnection();
                }}
              />
            ) : null}
          </FieldGroup.Section>
          <FieldGroup.Section title="About Daylight">
            <NativeText>A small collection of everyday rituals.</NativeText>
            <NativeText>Version 0.1.0 · Made with Expo UI</NativeText>
          </FieldGroup.Section>
        </FieldGroup>
      </NativeHost>
    </View>
  );
}
