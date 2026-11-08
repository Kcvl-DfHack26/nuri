import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { authClient } from '@/lib/api';
import { changeFollow, setCachedFollow, userKeys } from '@/lib/social';

const followMutations = ['follow'];

/**
 * The follow button for one user, the same on ⑤'s author row and their profile (#195). Guests are
 * sent to ⑱ first (#42), and nobody gets a button for themselves (`undefined`). The change shows at
 * once on the cached profiles and is rolled back if the server rejects it.
 */
export function useFollow(user: { id: string; following: boolean } | undefined) {
  const client = useQueryClient();
  const { data: session } = authClient.useSession();
  const viewerId = session?.user.id;
  // Shared by every button for this user, so ⑤ and the profile never send overlapping changes.
  const mutationKey = [...followMutations, viewerId, user?.id];
  const pending = useIsMutating({ mutationKey }) > 0;
  const toggle = useMutation({
    mutationKey,
    mutationFn: ({ id, following }: { id: string; following: boolean }) =>
      changeFollow(id, following),
    onMutate: async ({ id, following }) => {
      // A fetch under way would overwrite the change with older data. Loads without data yet are
      // left alone: cancelling them would leave their screens waiting with nothing.
      await client.cancelQueries({
        queryKey: userKeys.all,
        predicate: (query) => query.state.data !== undefined,
      });
      return viewerId !== undefined && setCachedFollow(client, id, viewerId, !following);
    },
    onError: (error, { id, following }, changed) => {
      // Undo only a change this tap made; a profile that already showed the new state stays.
      if (changed && viewerId !== undefined) {
        setCachedFollow(client, id, viewerId, following);
      }
      Alert.alert('フォローを変更できませんでした', error.message);
    },
    onSettled: () => {
      // Refetch the counts once the last pending follow settles, so a result never undoes another.
      if (client.isMutating({ mutationKey: followMutations }) === 1) {
        return client.invalidateQueries({ queryKey: userKeys.all });
      }
    },
  });
  if (!user || user.id === viewerId) {
    return undefined;
  }
  return {
    following: user.following,
    onPress: () => {
      if (!session) {
        router.push('/account');
        return;
      }
      if (!pending) {
        toggle.mutate({ id: user.id, following: user.following });
      }
    },
  };
}
