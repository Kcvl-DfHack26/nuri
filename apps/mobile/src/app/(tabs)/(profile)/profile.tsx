import { Icon } from '@expo/ui';
import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';

import { Profile } from '@/components/profile';

export default function ProfileScreen() {
  return (
    <>
      <Profile />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="設定"
          icon={Icon.select({
            ios: 'gearshape',
            android: import('@expo/material-symbols/settings.xml'),
          })}
          onPress={() => {
            router.push('/settings');
          }}
        >
          設定
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}
