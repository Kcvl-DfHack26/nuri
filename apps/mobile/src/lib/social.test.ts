import { createTestQueryClient } from '@/lib/test/query-client';

import { setCachedFollow, userKeys } from './social';

jest.mock('@/lib/api', () => ({ api: {} }));

const profile = (id: string, counts: { followerCount: number; followingCount: number }) => ({
  id,
  following: false,
  likeCount: 0,
  ...counts,
});

test('follows once in the cached profiles and undoes it', () => {
  const client = createTestQueryClient();
  // Plain keys keep the fixtures small; they are the same keys as `userOptions`.
  client.setQueryData(
    [...userKeys.all, 'mio'],
    profile('mio', { followerCount: 3, followingCount: 0 }),
  );
  client.setQueryData(
    [...userKeys.all, 'me'],
    profile('me', { followerCount: 0, followingCount: 5 }),
  );

  expect(setCachedFollow(client, 'mio', 'me', true)).toBe(true);
  // A second tap or retry for the same state changes nothing.
  expect(setCachedFollow(client, 'mio', 'me', true)).toBe(false);
  expect(client.getQueryData([...userKeys.all, 'mio'])).toMatchObject({
    following: true,
    followerCount: 4,
  });
  expect(client.getQueryData([...userKeys.all, 'me'])).toMatchObject({ followingCount: 6 });

  expect(setCachedFollow(client, 'mio', 'me', false)).toBe(true);
  expect(client.getQueryData([...userKeys.all, 'mio'])).toMatchObject({
    following: false,
    followerCount: 3,
  });
  expect(client.getQueryData([...userKeys.all, 'me'])).toMatchObject({ followingCount: 5 });
});

test('changes nothing for a profile that is not loaded', () => {
  const client = createTestQueryClient();
  expect(setCachedFollow(client, 'mio', 'me', true)).toBe(false);
  expect(client.getQueryData([...userKeys.all, 'mio'])).toBeUndefined();
});
