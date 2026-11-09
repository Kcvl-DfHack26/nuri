import { Icon } from '@expo/ui';
import { recipeSearchMaxLength } from '@starter/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Feedback } from '@/components/feedback';
import { GlassIconButton } from '@/components/glass-icon-button';
import { RecipeList } from '@/components/recipe-list';
import { SocialIcon } from '@/components/social-icon';
import { apiUrl } from '@/lib/api';
import { backOrHome } from '@/lib/navigation';
import { recipeListOptions } from '@/lib/recipes';
import { useTokenColor } from '@/theme/tokens';

const BACK = Icon.select({
  ios: 'chevron.left',
  android: import('@expo/material-symbols/arrow_back_ios_new.xml'),
});
const SEARCH = Icon.select({
  ios: 'magnifyingglass',
  android: import('@expo/material-symbols/search.xml'),
});

const debounceMs = 300;

// Plan A has no search results screen: ①'s search field becomes a text field above ①'s cards.
// Search covers whole-face and part recipes by title and tag.
export function RecipeSearch() {
  const insets = useSafeAreaInsets();
  const ink = useTokenColor('--color-ink-primary');
  const placeholder = useTokenColor('--color-ink-secondary');
  const [text, setText] = useState('');
  // Search once typing pauses, not on every keystroke.
  const [term, setTerm] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(text.trim());
    }, debounceMs);
    return () => {
      clearTimeout(timer);
    };
  }, [text]);
  const list = useInfiniteQuery({
    ...recipeListOptions({ q: term }),
    enabled: Boolean(apiUrl) && term !== '',
  });
  const status = !apiUrl ? (
    <Feedback message="接続先が未設定です。セットアップ後にレシピを検索できます。" />
  ) : term === '' ? (
    <Feedback message="レシピのタイトルやタグで探せます" />
  ) : list.isPending ? (
    <Feedback loading message="レシピを探しています" />
  ) : list.isError ? (
    <Feedback
      message="レシピを探せませんでした。通信状況を確認してお試しください。"
      onRetry={() => {
        void list.refetch();
      }}
    />
  ) : null;
  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top + 6 }}>
      <StatusBar style="dark" />
      <View className="flex-row items-center gap-3 px-4 pb-3">
        <GlassIconButton
          icon={BACK}
          label="戻る"
          className="border-black/8 bg-white"
          onPress={() => {
            backOrHome();
          }}
        />
        <View className="min-h-12 flex-1 flex-row items-center gap-2 rounded-full border border-black bg-white pl-3.5 pr-4">
          <SocialIcon name={SEARCH} webGlyph="⌕" size={22} color={ink} />
          <TextInput
            accessibilityLabel="メイクを検索"
            placeholder="メイクを検索"
            placeholderTextColor={placeholder}
            // The person tapped ①'s search field to get here, so typing starts right away.
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            maxLength={recipeSearchMaxLength}
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => {
              setTerm(text.trim());
            }}
            className="flex-1 py-2 font-maru text-ui text-ink-primary"
          />
        </View>
      </View>
      <RecipeList
        automaticallyAdjustKeyboardInsets
        query={list}
        status={status}
        emptyMessage={`「${term}」に合うレシピはありません`}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 24, gap: 14 }}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}
