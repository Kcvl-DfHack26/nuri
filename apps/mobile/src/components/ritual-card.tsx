import type { Ritual } from '@starter/shared';

import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

export function RitualCard({ ritual, saved = false }: { ritual: Ritual; saved?: boolean }) {
  return (
    <Link href={{ pathname: '/ritual/[id]', params: { id: ritual.id } }} asChild>
      <Pressable
        accessibilityLabel={`${ritual.title}, ${ritual.minutes} minutes${saved ? ', saved' : ''}`}
        testID={`ritual-${ritual.id}`}
        style={({ pressed }) => ({
          backgroundColor: colors.card,
          padding: 20,
          borderRadius: 22,
          borderCurve: 'continuous',
          opacity: pressed ? 0.7 : 1,
          gap: 9,
          minHeight: 128,
        })}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Text
            style={{ color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}
          >
            {ritual.category.toUpperCase()}
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 13 }}>
            {ritual.minutes} min{saved ? ' · Saved' : ''}
          </Text>
        </View>
        <Text style={{ color: colors.text, fontSize: 21, fontWeight: '600' }}>{ritual.title}</Text>
        <Text style={{ color: colors.secondary, fontSize: 15, lineHeight: 22 }}>
          {ritual.subtitle}
        </Text>
      </Pressable>
    </Link>
  );
}
