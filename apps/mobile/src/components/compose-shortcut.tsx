import { Button, Icon, Row, Spacer, Text } from '@expo/ui';
import { router } from 'expo-router';

import { NativeHost } from '@/components/native-host';
import { authClient } from '@/lib/api';
import { iconSize } from '@/theme/metrics';

export function ComposeShortcut() {
  const session = authClient.useSession();
  return (
    <NativeHost style={{ flex: 1 }}>
      <Button
        variant="text"
        onPress={() => {
          router.push(session.data ? '/compose' : '/account');
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <Row spacing={10} style={{ width: '100%', paddingHorizontal: 20, paddingVertical: 12 }}>
          <Icon
            name={Icon.select({
              ios: 'square.and.pencil',
              android: import('@expo/material-symbols/edit_square.xml'),
            })}
            size={iconSize}
          />
          <Text>投稿を作成</Text>
          <Spacer />
        </Row>
      </Button>
    </NativeHost>
  );
}
