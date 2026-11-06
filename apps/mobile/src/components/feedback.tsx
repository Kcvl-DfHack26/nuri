import { Button } from '@expo/ui';
import { ActivityIndicator, View } from 'react-native';

import { NativeHost } from '@/components/native-host';
import { Screen } from '@/components/screen';
import { Text } from '@/components/ui/text';

export function Feedback({
  message,
  loading = false,
  onRetry,
  fullScreen = false,
}: {
  message: string;
  loading?: boolean;
  onRetry?: () => void;
  fullScreen?: boolean;
}) {
  const content = (
    <View style={{ gap: 16, paddingVertical: 16 }}>
      {loading ? <ActivityIndicator accessibilityLabel="読み込み中" /> : null}
      <Text selectable accessibilityRole={onRetry ? 'alert' : undefined}>
        {message}
      </Text>
      {onRetry ? (
        <NativeHost matchContents={{ vertical: true }}>
          <Button label="もう一度試す" onPress={onRetry} />
        </NativeHost>
      ) : null}
    </View>
  );
  return fullScreen ? <Screen>{content}</Screen> : content;
}
