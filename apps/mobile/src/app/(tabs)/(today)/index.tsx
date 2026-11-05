import { Button } from '@expo/ui';
import { rituals } from '@starter/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { NativeHost } from '@/components/native-host';
import { RitualCard } from '@/components/ritual-card';
import { todayKey, usePreferences } from '@/lib/preferences';
import { colors } from '@/theme/colors';

export default function TodayScreen() {
  const [date] = useState(() => new Date());
  const { preferences, storageError } = usePreferences();
  const completed = preferences.completed[todayKey()]?.length ?? 0;
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 36 }}
    >
      <Text
        style={{ color: colors.secondary, fontSize: 13, letterSpacing: 1.4, fontWeight: '600' }}
      >
        {date
          .toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })
          .toUpperCase()}
      </Text>
      <View
        style={{
          backgroundColor: colors.hero,
          borderRadius: 28,
          borderCurve: 'continuous',
          padding: 28,
          gap: 18,
        }}
      >
        <Text style={{ color: colors.heroText, fontSize: 13, fontWeight: '700', letterSpacing: 2 }}>
          A MOMENT FOR YOU
        </Text>
        <Text style={{ color: colors.heroText, fontSize: 36, lineHeight: 42, fontWeight: '600' }}>
          Make room{'\n'}for a little calm.
        </Text>
        <Text style={{ color: colors.heroText, fontSize: 16, lineHeight: 24 }}>
          Good days start with small things.{'\n'}Take five minutes. Start here.
        </Text>
        <NativeHost matchContents>
          <Button
            label="Find your morning moment"
            testID="start-morning"
            onPress={() => {
              router.push('/ritual/morning');
            }}
          />
        </NativeHost>
      </View>
      <View style={{ gap: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
            Your daily rhythm
          </Text>
          <Text testID="daily-progress" style={{ color: colors.secondary, fontSize: 15 }}>
            {completed} of {preferences.dailyGoal}
          </Text>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: preferences.dailyGoal,
            now: Math.min(completed, preferences.dailyGoal),
          }}
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.separator,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.accent,
              width: `${Math.min(100, (completed / preferences.dailyGoal) * 100)}%`,
            }}
          />
        </View>
        <Text style={{ color: colors.secondary, fontSize: 15 }}>
          {completed >= preferences.dailyGoal
            ? 'You made time for yourself. That counts.'
            : 'A few small pauses can change the shape of your day.'}
        </Text>
      </View>
      {storageError ? (
        <Text accessibilityRole="alert" style={{ color: colors.text }}>
          {storageError}
        </Text>
      ) : null}
      <View style={{ gap: 12 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
          Made for a slower day
        </Text>
        {rituals.slice(1, 3).map((ritual) => (
          <RitualCard
            key={ritual.id}
            ritual={ritual}
            saved={preferences.favorites.includes(ritual.id)}
          />
        ))}
      </View>
      <Text style={{ textAlign: 'center', color: colors.secondary, fontSize: 13 }}>
        A little more present. A little more you.
      </Text>
    </ScrollView>
  );
}
