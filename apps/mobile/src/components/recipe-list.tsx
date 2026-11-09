import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { FlatListProps } from 'react-native';

import { useMemo } from 'react';
import { FlatList, View } from 'react-native';

import type { RecipePage, RecipeSummary } from '@/lib/recipes';

import { Feedback } from '@/components/feedback';
import { RecipeCard } from '@/components/recipe-card';
import { cardGrid, cardGridGap, cardGridInset, useLayoutSize } from '@/lib/layout';

type RecipeListProps = Pick<
  FlatListProps<RecipeSummary>,
  | 'automaticallyAdjustKeyboardInsets'
  | 'contentContainerStyle'
  | 'contentInsetAdjustmentBehavior'
  | 'keyboardDismissMode'
  | 'keyboardShouldPersistTaps'
> & {
  query: Pick<
    UseInfiniteQueryResult<InfiniteData<RecipePage>>,
    'data' | 'fetchNextPage' | 'hasNextPage' | 'isFetchingNextPage' | 'isError'
  >;
  status: ReactNode;
  emptyMessage: string;
};

export function RecipeList({
  query,
  status,
  emptyMessage,
  contentContainerStyle,
  ...props
}: RecipeListProps) {
  const { width, onLayout } = useLayoutSize();
  const { columns, cardWidth } = cardGrid(width);
  const { data } = query;
  const items = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  return (
    <FlatList
      {...props}
      data={items}
      // FlatList uses a different row model for each column count.
      key={columns}
      numColumns={columns}
      onLayout={onLayout}
      keyExtractor={(recipe) => recipe.id}
      columnWrapperStyle={columns > 1 ? { gap: cardGridGap } : undefined}
      contentContainerStyle={[contentContainerStyle, { paddingHorizontal: cardGridInset }]}
      // A failed next page keeps the loaded cards and shows the retry above them.
      ListHeaderComponent={status ? <View className="px-4">{status}</View> : undefined}
      ListEmptyComponent={
        status ? undefined : (
          <View className="px-4">
            <Feedback message={emptyMessage} />
          </View>
        )
      }
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage && !query.isError) {
          void query.fetchNextPage();
        }
      }}
      renderItem={({ item }) => <RecipeCard recipe={item} width={cardWidth} />}
    />
  );
}
