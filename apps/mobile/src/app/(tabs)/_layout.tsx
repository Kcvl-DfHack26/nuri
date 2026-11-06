import { usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { Platform } from 'react-native';

import { ComposeShortcut } from '@/components/compose-shortcut';
import { useTokenColor } from '@/theme/tokens';

export default function TabsLayout() {
  const pathname = usePathname();
  const rose = useTokenColor('--color-accent-rose');
  return (
    <NativeTabs tintColor={rose}>
      {Platform.OS === 'ios' && Number(Platform.Version) >= 26 && pathname === '/timeline' ? (
        <NativeTabs.BottomAccessory>
          <ComposeShortcut />
        </NativeTabs.BottomAccessory>
      ) : null}
      <NativeTabs.Trigger name="(make)">
        <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
        <NativeTabs.Trigger.Label>メイク</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(suggest)">
        <NativeTabs.Trigger.Icon sf="viewfinder" md="center_focus_weak" />
        <NativeTabs.Trigger.Label>提案</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(feed)">
        <NativeTabs.Trigger.Icon sf="plus.circle" md="add_circle" />
        <NativeTabs.Trigger.Label>投稿</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(profile)">
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
        <NativeTabs.Trigger.Label>マイ</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
