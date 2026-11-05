import { Picker, TextInput } from '@expo/ui';
import { filterRituals, rituals } from '@starter/shared';
import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import { NativeHost } from '@/components/native-host';
import { RitualCard } from '@/components/ritual-card';
import { usePreferences } from '@/lib/preferences';
import { colors } from '@/theme/colors';

export function Library() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const { preferences } = usePreferences();
  const items = filterRituals(
    query,
    filter === 'saved'
      ? rituals.filter((ritual) => preferences.favorites.includes(ritual.id))
      : rituals,
  );
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 36 }}
      ListHeaderComponent={
        <View style={{ gap: 16, paddingBottom: 8 }}>
          <Text style={{ color: colors.secondary, fontSize: 17, lineHeight: 24 }}>
            Small rituals. Room for a better day.
          </Text>
          <NativeHost matchContents>
            <TextInput
              accessibilityLabel="Search rituals"
              placeholder="Search rituals"
              onChangeText={setQuery}
              maxLength={100}
              testID="search-rituals"
              style={{ padding: 14, borderRadius: 14 }}
            />
          </NativeHost>
          <NativeHost matchContents>
            <Picker selectedValue={filter} onValueChange={setFilter} testID="library-filter">
              <Picker.Item label="All rituals" value="all" />
              <Picker.Item label="Saved rituals" value="saved" />
            </Picker>
          </NativeHost>
        </View>
      }
      ListEmptyComponent={
        <View style={{ paddingVertical: 40, gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 21, fontWeight: '600' }}>
            Nothing here yet
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 16 }}>
            Try a different search, or save a ritual you like.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <RitualCard ritual={item} saved={preferences.favorites.includes(item.id)} />
      )}
    />
  );
}
