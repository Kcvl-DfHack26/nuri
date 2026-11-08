import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { authClient } from '@/lib/api';
import { changeFavorite, recipeKeys, setCachedFavorite } from '@/lib/recipes';

/**
 * The heart of one recipe, the same on ①'s cards, ③, ⑤ and ⑭ (#191). Guests are sent to ⑱ first
 * (#42). The change shows at once in every cached copy of this recipe and is rolled back if the
 * server rejects it; other recipes and the lists themselves are not fetched again.
 */
export function useFavorite(recipe: { id: string; favorited: boolean }) {
  const client = useQueryClient();
  const { data: session } = authClient.useSession();
  // Shared by every heart of this recipe, so a card and ⑤ never send overlapping changes.
  const mutationKey = ['favorite', session?.user.id, recipe.id];
  const pending = useIsMutating({ mutationKey }) > 0;
  const toggle = useMutation({
    mutationKey,
    mutationFn: (favorited: boolean) => changeFavorite(recipe.id, favorited),
    onMutate: async (favorited) => {
      await client.cancelQueries({ queryKey: recipeKeys.all });
      setCachedFavorite(client, recipe.id, !favorited);
    },
    onError: (error, favorited) => {
      setCachedFavorite(client, recipe.id, favorited);
      Alert.alert('お気に入りを変更できませんでした', error.message);
    },
    onSettled: () => {
      // Only the favorites list changes membership; the other lists already show the change.
      void client.invalidateQueries({ queryKey: recipeKeys.favorites });
    },
  });
  return {
    favorited: recipe.favorited,
    onPress: () => {
      if (!session) {
        router.push('/account');
        return;
      }
      if (!pending) {
        toggle.mutate(recipe.favorited);
      }
    },
  };
}
