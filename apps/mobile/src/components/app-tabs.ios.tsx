import { NativeTabs } from 'expo-router/native-tabs';

import { useTokenColor } from '@/theme/tokens';

// iOS keeps the system tab bar; iOS 26 draws it as Liquid Glass like Plan A's TabBar/Glass.
export function AppTabs() {
  const rose = useTokenColor('--color-accent-rose');
  return (
    <NativeTabs tintColor={rose}>
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
