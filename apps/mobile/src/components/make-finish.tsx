import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FaceScene } from '@/components/face-scene';
import { GlassIconButton } from '@/components/glass-icon-button';
import { COMPARE } from '@/components/make-compare';
import { arPhotos, findRecipe } from '@/components/recipes';
import { Text } from '@/components/ui/text';
import { backOrHome } from '@/lib/navigation';

import finishSparkles from '../../assets/plan-a/ar/finish-sparkles.svg';
import sparkleInk from '../../assets/plan-a/icons/sparkle-ink.svg';

const CLOSE = Icon.select({ ios: 'xmark', android: import('@expo/material-symbols/close.xml') });
const DOWNLOAD = Icon.select({
  ios: 'arrow.down.to.line',
  android: import('@expo/material-symbols/download.xml'),
});

// Plan A ⑩ 完成.
export function MakeFinish({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const recipe = findRecipe(id);
  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <FaceScene photo={arPhotos.finished}>
        <View
          className="absolute inset-x-0 bottom-0 h-[45.4%]"
          style={{
            backgroundImage:
              'linear-gradient(to bottom, rgba(255,250,252,0) 0%, rgba(255,250,252,0.92) 35%, #fffafc 100%)',
          }}
        />
        <Image
          accessible={false}
          source={finishSparkles}
          contentFit="fill"
          style={{ position: 'absolute', width: '100%', height: '100%' }}
        />
      </FaceScene>
      <View className="absolute inset-x-4 flex-row justify-between" style={{ top: insets.top + 8 }}>
        <GlassIconButton
          icon={CLOSE}
          label="閉じる"
          onPress={() => {
            backOrHome();
          }}
        />
        <View className="flex-row gap-2">
          <GlassIconButton
            icon={COMPARE}
            label="メイク前と比べる"
            onPress={() => {
              router.push(`/recipes/${id}/compare`);
            }}
          />
          <GlassIconButton icon={DOWNLOAD} label="写真を保存（準備中）" />
        </View>
      </View>
      <View
        className="absolute inset-x-0 bottom-0 items-center gap-3.5 px-5"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Text
          accessibilityRole="header"
          className="font-maru-black text-[60px] leading-[76px] text-accent-rose"
        >
          Finish!
        </Text>
        <Text className="font-maru-bold text-heading text-ink-primary">
          {recipe ? `${recipe.title}のできあがり` : 'メイクのできあがり'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            router.dismissTo('/');
          }}
          className="min-h-[52px] w-full flex-row items-center justify-center gap-1.5 rounded-full border border-line-soft bg-white px-[18px] active:opacity-70"
        >
          <Image accessible={false} source={sparkleInk} style={{ width: 20, height: 20 }} />
          <Text className="font-maru-bold text-action text-ink-primary">次のメイクを試す？</Text>
        </Pressable>
      </View>
    </View>
  );
}
