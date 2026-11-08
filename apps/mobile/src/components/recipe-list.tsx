import type { FlatListProps } from 'react-native';

import { FlatList } from 'react-native';

import type { RecipeSummary } from '@/lib/recipes';

import { RecipeCard } from '@/components/recipe-card';
import { cardGrid, cardGridGap, cardGridInset, useLayoutSize } from '@/lib/layout';

type RecipeListProps = Omit<
  FlatListProps<RecipeSummary>,
  'columnWrapperStyle' | 'keyExtractor' | 'numColumns' | 'onLayout' | 'renderItem'
>;

export function RecipeList({ contentContainerStyle, ...props }: RecipeListProps) {
  const { width, onLayout } = useLayoutSize();
  const { columns, cardWidth } = cardGrid(width);

  return (
    <FlatList
      {...props}
      // FlatList uses a different row model for each column count.
      key={columns}
      numColumns={columns}
      onLayout={onLayout}
      keyExtractor={(recipe) => recipe.id}
      columnWrapperStyle={columns > 1 ? { gap: cardGridGap } : undefined}
      contentContainerStyle={[contentContainerStyle, { paddingHorizontal: cardGridInset }]}
      renderItem={({ item }) => <RecipeCard recipe={item} width={cardWidth} />}
    />
  );
}
