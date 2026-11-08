import type { QueryClient } from '@tanstack/react-query';
import type { InferRequestType, InferResponseType } from 'hono/client';

import { queryOptions } from '@tanstack/react-query';

import { api } from '@/lib/api';

export const userKeys = { all: ['user'] as const };

/** A user's profile with follow counts (⑤'s author, other profiles, ⑰). */
export function userOptions(id: string) {
  return queryOptions({
    queryKey: [...userKeys.all, id],
    queryFn: async ({ signal }) => {
      const response = await api.api.users[':id'].$get({ param: { id } }, { init: { signal } });
      if (response.status !== 200) {
        throw new Error('プロフィールを読み込めませんでした。');
      }
      return (await response.json()).user;
    },
  });
}

/** The signed-in user's own profile, with what only they see, such as the face type (⑰, ⑰-2, ⑭). */
export const myProfileKeys = { all: ['my-profile'] as const };

export function myProfileOptions(userId: string | undefined) {
  return queryOptions({
    queryKey: [...myProfileKeys.all, userId],
    enabled: Boolean(userId),
    queryFn: async ({ signal }) => {
      const response = await api.api.me.profile.$get({}, { init: { signal } });
      if (response.status !== 200) {
        throw new Error('プロフィールを読み込めませんでした。');
      }
      return (await response.json()).profile;
    },
  });
}

export type MyProfile = InferResponseType<typeof api.api.me.profile.$get, 200>['profile'];
export type ProfileChanges = InferRequestType<typeof api.api.me.profile.$patch>['json'];

/** Saves changes to the signed-in user's profile (⑰-2, ⑭). */
export async function changeProfile(json: ProfileChanges) {
  const response = await api.api.me.profile.$patch({ json });
  if (response.status === 409) {
    throw new Error('このユーザーIDは既に使われています。');
  }
  if (response.status !== 200) {
    throw new Error('変更を保存できませんでした。もう一度お試しください。');
  }
}

export type UserProfile = InferResponseType<(typeof api.api.users)[':id']['$get'], 200>['user'];

export async function changeFollow(id: string, following: boolean) {
  const endpoint = api.api.users[':id'].follow;
  const response = following
    ? await endpoint.$delete({ param: { id } })
    : await endpoint.$put({ param: { id } });
  if (!response.ok) {
    throw new Error(
      response.status === 401 ? 'ログインし直してください。' : 'フォローを変更できませんでした。',
    );
  }
}

/**
 * Shows the viewer as following `id` or not: the followee's cached profile flips and its follower
 * count moves by one, and so does the viewer's following count. Nothing changes when the cached
 * profile already shows that state, so a retry or a second tap never counts twice. Returns
 * whether it changed, for the rollback.
 */
export function setCachedFollow(
  client: QueryClient,
  id: string,
  viewerId: string,
  following: boolean,
) {
  const step = following ? 1 : -1;
  const followee = client.getQueryData(userOptions(id).queryKey);
  if (!followee || followee.following === following) {
    return false;
  }
  client.setQueryData(userOptions(id).queryKey, {
    ...followee,
    following,
    followerCount: Math.max(0, followee.followerCount + step),
  });
  client.setQueryData(
    userOptions(viewerId).queryKey,
    (viewer) => viewer && { ...viewer, followingCount: Math.max(0, viewer.followingCount + step) },
  );
  return true;
}
