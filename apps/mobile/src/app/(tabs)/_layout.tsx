import { usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { Platform } from 'react-native';

import { ComposeShortcut } from '@/components/compose-shortcut';

export default function TabsLayout() {
  const pathname = usePathname();
  return (
    <NativeTabs>
      {Platform.OS === 'ios' && Number(Platform.Version) >= 26 && pathname !== '/settings' ? (
        <NativeTabs.BottomAccessory>
          <ComposeShortcut />
        </NativeTabs.BottomAccessory>
      ) : null}
      <NativeTabs.Trigger name="(feed)">
        <NativeTabs.Trigger.Icon sf="text.bubble.fill" md="chat" />
        <NativeTabs.Trigger.Label>ホーム</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(profile)">
        <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" md="account_circle" />
        <NativeTabs.Trigger.Label>マイページ</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)">
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
        <NativeTabs.Trigger.Label>設定</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
