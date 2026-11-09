import { Icon } from '@expo/ui';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { backOrHome } from '@/lib/navigation';
import { useTokenColor } from '@/theme/tokens';

const CLOSE = Icon.select({ ios: 'xmark', android: import('@expo/material-symbols/close.xml') });
const LINK = Icon.select({ ios: 'link', android: import('@expo/material-symbols/link.xml') });

// Plan A ④ stays reachable from the make home, but reading posts waits on each service's terms
// and the poster's permission (#242), so the sheet only says the feature is coming.
export function SnsImport() {
  const insets = useSafeAreaInsets();
  const rose = useTokenColor('--color-accent-rose');
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          flexGrow: 1,
          gap: 16,
          paddingHorizontal: 20,
          paddingTop: 30,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
      >
        <SheetHeader />
        <View className="items-center gap-3 rounded-card bg-bg-base px-5 py-8">
          <View className="size-14 items-center justify-center rounded-full bg-pastel-pink">
            <SocialIcon name={LINK} size={28} color={rose} />
          </View>
          <Text accessibilityRole="header" className="font-maru-bold text-heading text-ink-primary">
            準備中
          </Text>
          <Text className="text-center font-maru text-ui text-ink-primary">
            SNSの動画からレシピを作る機能は、いま準備しています。
          </Text>
          <Text className="text-center font-maru text-meta text-ink-secondary">
            自分で撮った動画や端末にある動画からは、下の「投稿」でレシピを作れます。
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function SheetHeader() {
  const ink = useTokenColor('--color-ink-primary');
  return (
    <View className="flex-row items-center gap-3">
      <Text
        accessibilityRole="header"
        className="flex-1 font-maru-bold text-heading text-ink-primary"
      >
        SNSの動画をレシピにする
      </Text>
      {/* hitSlop cannot reach past this 36pt row, so the 48pt target holds the 36pt circle. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="閉じる"
        onPress={() => {
          backOrHome();
        }}
        className="-my-1.5 -mr-1.5 size-12 items-center justify-center active:opacity-70"
      >
        <View className="size-9 items-center justify-center rounded-full bg-neutral-soft">
          <SocialIcon name={CLOSE} size={18} color={ink} />
        </View>
      </Pressable>
    </View>
  );
}
