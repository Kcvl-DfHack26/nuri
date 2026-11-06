import { Icon } from '@expo/ui';
import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { Platform } from 'react-native';

import { Feed } from '@/components/feed';
import { authClient } from '@/lib/api';
export default function TimelineScreen() {
  const session = authClient.useSession();
  return (
    <>
      <Feed />
      {Platform.OS !== 'ios' || Number(Platform.Version) < 26 ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="投稿を作成"
            icon={Icon.select({
              ios: 'square.and.pencil',
              android: import('@expo/material-symbols/edit_square.xml'),
            })}
            onPress={() => {
              router.push(session.data ? '/compose' : '/account');
            }}
          >
            投稿
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
    </>
  );
}
