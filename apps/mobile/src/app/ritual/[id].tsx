import { BottomSheet, Button, RNHostView } from '@expo/ui';
import { rituals } from '@starter/shared';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { NativeHost } from '@/components/native-host';
import { todayKey, usePreferences } from '@/lib/preferences';
import { colors } from '@/theme/colors';

export default function RitualScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ritual = rituals.find((item) => item.id === id);
  const { preferences, toggleFavorite, complete, storageError } = usePreferences();
  const [isPresented, setPresented] = useState(false);
  if (!ritual) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <Text style={{ padding: 24, color: colors.text }}>
          This ritual could not be found. Go back to the Library to find another.
        </Text>
      </ScrollView>
    );
  }
  const saved = preferences.favorites.includes(ritual.id);
  const completed = preferences.completed[todayKey()]?.includes(ritual.id) ?? false;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 48 }}
    >
      <Stack.Screen options={{ title: ritual.title }} />
      <View
        style={{
          backgroundColor: colors.hero,
          borderRadius: 28,
          borderCurve: 'continuous',
          padding: 28,
          gap: 16,
        }}
      >
        <Text
          style={{ color: colors.heroText, fontSize: 13, letterSpacing: 1.6, fontWeight: '700' }}
        >
          {ritual.category.toUpperCase()} · {ritual.minutes} MINUTES
        </Text>
        <Text style={{ color: colors.heroText, fontSize: 34, fontWeight: '600', lineHeight: 41 }}>
          {ritual.title}
        </Text>
        <Text style={{ color: colors.heroText, fontSize: 17, lineHeight: 25 }}>
          {ritual.subtitle}
        </Text>
      </View>
      <View style={{ gap: 20 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '600' }}>
          A simple place to begin
        </Text>
        {ritual.steps.map((step, index) => (
          <View key={step} style={{ flexDirection: 'row', gap: 16 }}>
            <Text style={{ color: colors.accent, fontSize: 18, fontWeight: '700' }}>
              {index + 1}.
            </Text>
            <Text style={{ flex: 1, color: colors.text, fontSize: 17, lineHeight: 26 }}>
              {step}
            </Text>
          </View>
        ))}
      </View>
      <NativeHost matchContents>
        <Button
          label={saved ? 'Remove from saved' : 'Save this ritual'}
          variant="outlined"
          onPress={() => {
            toggleFavorite(ritual.id);
          }}
          testID="save-ritual"
        />
      </NativeHost>
      <NativeHost matchContents>
        <Button
          label={completed ? 'Completed today' : 'Mark as complete'}
          disabled={completed}
          onPress={() => {
            complete(ritual.id);
            setPresented(true);
          }}
          testID="complete-ritual"
        />
      </NativeHost>
      {storageError ? (
        <Text accessibilityRole="alert" style={{ color: colors.text }}>
          {storageError}
        </Text>
      ) : null}
      <NativeHost>
        <BottomSheet
          isPresented={isPresented}
          onDismiss={() => {
            setPresented(false);
          }}
          contentPadding={24}
        >
          <RNHostView matchContents={{ vertical: true }}>
            <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 24 }}>
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: '600' }}>
                {storageError ? 'Let’s try that again' : 'A little time, well spent.'}
              </Text>
              <Text style={{ color: colors.secondary, fontSize: 17, lineHeight: 25 }}>
                {storageError ??
                  'Your ritual is complete. Take this feeling with you into the rest of your day.'}
              </Text>
              <NativeHost matchContents>
                <Button
                  label="Done"
                  onPress={() => {
                    setPresented(false);
                  }}
                  testID="dismiss-completion"
                />
              </NativeHost>
            </ScrollView>
          </RNHostView>
        </BottomSheet>
      </NativeHost>
    </ScrollView>
  );
}
