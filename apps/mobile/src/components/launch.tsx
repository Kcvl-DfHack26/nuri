import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';

import logo from '../../assets/plan-a/start/logo.svg';

// Plan A ⓪ 起動画面, shown in place of the app while the Zen Maru Gothic fonts load.
// The wordmark cannot use those fonts yet, so it falls back to the system font's black weight.
export function Launch() {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessible
      accessibilityLabel="nuri 読み込み中"
      className="flex-1 items-center justify-center bg-white"
    >
      <StatusBar style="dark" />
      <Image accessible={false} source={logo} style={{ width: 104, height: 104 }} />
      <Text
        className="absolute text-headline font-black text-accent-rose"
        style={{ bottom: insets.bottom + 48 }}
      >
        nuri
      </Text>
    </View>
  );
}
