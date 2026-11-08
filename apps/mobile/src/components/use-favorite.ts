import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { authClient } from '@/lib/api';
import { changeFavorite, recipeKeys, setCachedFavorite } from '@/lib/recipes';

const favoriteMutations = ['favorite'];

/**
 * The heart of one recipe, the same on ①'s cards, ③, ⑤ and ⑭ (#191). Guests are sent to ⑱ first
 * (#42). The change shows at once in every cached copy of this recipe and is rolled back if the
 * server rejects it; other recipes and the lists themselves are not fetched again.
 */
export function useFavorite(recipe: { id: string; favorited: boolean }) {
  const client = useQueryClient();
  const { data: session } = authClient.useSession();
  // Shared by every heart of this recipe, so a card and ⑤ never send overlapping changes.
  const mutationKey = [...favoriteMutations, session?.user.id, recipe.id];
  const pending = useIsMutating({ mutationKey }) > 0;
  const toggle = useMutation({
    mutationKey,
    mutationFn: (favorited: boolean) => changeFavorite(recipe.id, favorited),
    onMutate: async (favorited) => {
      // A fetch already under way would overwrite the change with older data. Loads without data
      // yet are left alone: cancelling them would leave their screens waiting with nothing.
      await client.cancelQueries({
        queryKey: recipeKeys.all,
        predicate: (query) => query.state.data !== undefined,
      });
      return setCachedFavorite(client, recipe.id, !favorited);
    },
    onError: (error, favorited, changed) => {
      // Undo only the caches this change touched; a copy that already showed the new state stays.
      setCachedFavorite(client, recipe.id, favorited, changed ?? []);
      Alert.alert('お気に入りを変更できませんでした', error.message);
    },
    onSettled: () => {
      // Only the favorites list changes membership; the other lists already show the change.
      // Refetch once the last pending heart settles, so the result never undoes another change.
      if (client.isMutating({ mutationKey: favoriteMutations }) === 1) {
        return client.invalidateQueries({ queryKey: recipeKeys.favorites });
      }
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
