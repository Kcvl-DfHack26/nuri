import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CroppedPhoto } from '@/components/cropped-photo';
import { GlassIconButton } from '@/components/glass-icon-button';
import { samplePost, sampleSteps } from '@/components/sns-import-sample';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { backOrHome } from '@/lib/navigation';
import { useTokenColor } from '@/theme/tokens';

import sparkleRose from '../../assets/plan-a/import/sparkle-rose.svg';

const BACK = Icon.select({
  ios: 'chevron.left',
  android: import('@expo/material-symbols/arrow_back_ios_new.xml'),
});
const PLAY = Icon.select({
  ios: 'play.fill',
  android: import('@expo/material-symbols/play_arrow.xml'),
});
const MORE = Icon.select({
  ios: 'ellipsis',
  android: import('@expo/material-symbols/more_horiz.xml'),
});
const ADD = Icon.select({ ios: 'plus', android: import('@expo/material-symbols/add.xml') });

// Plan A ④-4 読み取った手順を確認. Editing, clip playback and the original post are not built yet.
export function SnsImportSteps() {
  const insets = useSafeAreaInsets();
  const ink = useTokenColor('--color-ink-primary');
  // The header and bottom bar float over the list; measure them so larger text never hides a row.
  const [headerHeight, setHeaderHeight] = useState(44);
  const [footerHeight, setFooterHeight] = useState(98);
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          gap: 10,
          paddingHorizontal: 16,
          paddingTop: insets.top + 12 + headerHeight,
          paddingBottom: footerHeight + 22,
        }}
      >
        <SourceCredit />
        {sampleSteps.map((step, index) => (
          <View
            key={step.part}
            className="flex-row items-center gap-3 rounded-[18px] border-[1.5px] border-line-soft bg-bg-surface py-2.5 pl-2.5 pr-2"
          >
            <View
              accessible
              accessibilityLabel={`手順${index + 1}、${step.label}、${step.hint}、区間 ${step.segment}`}
              className="flex-1 flex-row items-center gap-3"
            >
              <View className="h-[84px] w-[68px] overflow-hidden rounded-[14px]">
                <CroppedPhoto source={samplePost.photo} crop={step.crop} />
                <View className="absolute left-[5px] top-[5px] size-[22px] items-center justify-center rounded-full bg-accent-rose">
                  <Text className="font-maru-bold text-micro text-bg-surface">{index + 1}</Text>
                </View>
                <View className="absolute bottom-[5px] right-[5px] size-6 items-center justify-center rounded-full bg-bg-surface">
                  <SocialIcon name={PLAY} size={14} color={ink} />
                </View>
              </View>
              <View className="flex-1 gap-[3px]">
                <Text className="font-maru-bold text-action text-ink-primary">{step.label}</Text>
                <Text className="font-maru text-meta text-ink-secondary">{step.hint}</Text>
                <Text className="font-maru text-meta text-accent-rose">区間 {step.segment}</Text>
              </View>
            </View>
            <StepMenu label={step.label} />
          </View>
        ))}
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel="手順を追加（準備中）"
          accessibilityState={{ disabled: true }}
          className="min-h-12 flex-row items-center justify-center gap-1.5 rounded-3xl border border-dashed border-black"
        >
          <SocialIcon name={ADD} size={20} color={ink} />
          <Text className="font-maru-bold text-label text-ink-primary">手順を追加</Text>
        </View>
      </ScrollView>
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0"
        style={{
          height: insets.top + headerHeight + 20,
          backgroundImage:
            'linear-gradient(to bottom, #ffffff 0%, rgba(255,255,255,0.97) 82%, rgba(255,255,255,0) 100%)',
        }}
      />
      <View
        className="absolute inset-x-3 min-h-12 items-center justify-center"
        style={{ top: insets.top }}
        onLayout={(event) => {
          setHeaderHeight(event.nativeEvent.layout.height);
        }}
      >
        <Text
          accessibilityRole="header"
          className="px-12 text-center font-maru-bold text-heading text-ink-primary"
        >
          読み取った手順
        </Text>
        {/* Room around the 40pt button so its hitSlop reaches the full 48pt target. */}
        <View className="absolute left-0 size-12 items-center justify-center">
          <GlassIconButton
            icon={BACK}
            label="戻る"
            onPress={() => {
              backOrHome();
            }}
          />
        </View>
      </View>
      <View
        className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-[rgba(241,241,241,0.85)] px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        onLayout={(event) => {
          setFooterHeight(event.nativeEvent.layout.height);
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            // Nothing is stored yet; the sheet below shows ④-5 for the fixed sample.
            router.dismissTo({ pathname: '/import', params: { saved: '1' } });
          }}
          className="min-h-[52px] items-center justify-center rounded-[26px] bg-accent-rose px-[18px] active:opacity-80"
          style={{ boxShadow: '0px 8px 10px rgba(196, 61, 112, 0.25)' }}
        >
          <Text className="font-maru-bold text-action text-white">レシピとして保存</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SourceCredit() {
  return (
    <View
      className="flex-row items-center gap-3 rounded-[20px] p-3.5"
      style={{ backgroundImage: 'linear-gradient(to right, #ffd4e0, #ffe0cf)' }}
    >
      <View className="size-10 items-center justify-center rounded-full bg-bg-surface">
        <Image accessible={false} source={sparkleRose} style={{ width: 22, height: 22 }} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-maru-bold text-label text-ink-primary">{samplePost.title}</Text>
        <Text className="font-maru text-meta text-ink-secondary">
          {samplePost.author} の投稿から作成
        </Text>
      </View>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel="元の投稿を開く（準備中）"
        accessibilityState={{ disabled: true }}
        className="min-h-12 justify-center"
      >
        <Text className="font-maru-bold text-label text-accent-rose">元の投稿</Text>
      </View>
    </View>
  );
}

function StepMenu({ label }: { label: string }) {
  const secondary = useTokenColor('--color-ink-secondary');
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${label}の操作（準備中）`}
      accessibilityState={{ disabled: true }}
      className="h-12 w-[22px] items-center justify-center"
    >
      <SocialIcon name={MORE} size={22} color={secondary} />
    </View>
  );
}
