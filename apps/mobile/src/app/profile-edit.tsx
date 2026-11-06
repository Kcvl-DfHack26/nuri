import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';

import { ProfileEdit } from '@/components/profile-edit';

export default function Route() {
  return (
    <>
      <ProfileEdit />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          onPress={() => {
            router.back();
          }}
        >
          閉じる
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}
