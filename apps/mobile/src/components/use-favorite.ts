import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { authClient } from '@/lib/api';
import { changeFavorite, recipeKeys, recipeOptions, setCachedFavorite } from '@/lib/recipes';

const favoriteMutations = ['favorite'];

/**
 * The heart of one recipe, the same on ①'s cards, ③, ⑤ and ⑭ (#191). Guests are sent to ⑱ first
 * (#42). The change shows at once in every cached copy of this recipe and is rolled back if the
 * server rejects it; other recipes and the whole lists are not fetched again.
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
    // Nothing is cancelled, so loads of other recipes and pages carry on; a fetch that overlaps
    // the change is put right when it settles.
    onMutate: (favorited) => setCachedFavorite(client, recipe.id, !favorited),
    onError: (error, favorited, changed) => {
      // Undo only the caches this change touched; a copy that already showed the new state stays.
      setCachedFavorite(client, recipe.id, favorited, changed ?? []);
      Alert.alert('お気に入りを変更できませんでした', error.message);
    },
    onSettled: async () => {
      // ⑤ of this recipe, the one screen showing it alone, is fetched again. Of the lists only the
      // favorites list changes membership; it waits for the last pending heart so the result
      // never undoes another change.
      await Promise.all([
        client.invalidateQueries({ queryKey: recipeOptions(recipe.id).queryKey }),
        client.isMutating({ mutationKey: favoriteMutations }) === 1
          ? client.invalidateQueries({ queryKey: recipeKeys.favorites })
          : undefined,
      ]);
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
