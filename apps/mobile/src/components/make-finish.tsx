import { Icon } from '@expo/ui';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { canTrackFace, FaceMakeupCamera } from '@/components/face-makeup-camera';
import { FaceScene } from '@/components/face-scene';
import { GlassIconButton } from '@/components/glass-icon-button';
import { MediaLayout } from '@/components/media-layout';
import { RecipeStatus } from '@/components/recipe-detail';
import { arPhotos } from '@/components/recipes';
import { Text } from '@/components/ui/text';
import { apiUrl } from '@/lib/api';
import { finishLayers, recipeLayers } from '@/lib/face-makeup';
import { backOrHome } from '@/lib/navigation';
import { recipeOptions, shareRecipe } from '@/lib/recipes';

import finishSparkles from '../../assets/plan-a/ar/finish-sparkles.svg';
import sparkleInk from '../../assets/plan-a/icons/sparkle-ink.svg';

const CLOSE = Icon.select({ ios: 'xmark', android: import('@expo/material-symbols/close.xml') });
const SHARE = Icon.select({
  ios: 'square.and.arrow.up',
  android: import('@expo/material-symbols/ios_share.xml'),
});
const DOWNLOAD = Icon.select({
  ios: 'arrow.down.to.line',
  android: import('@expo/material-symbols/download.xml'),
});

// Plan A ⑩ 完成: every step of the recipe painted on the tracked face at once. Without the face
// tracker (Expo Go), Plan A's finished photo stands in.
export function MakeFinish({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const query = useQuery({ ...recipeOptions(id), enabled: Boolean(apiUrl) });
  const recipe = query.data;
  // The live finish paints the recipe's steps, so it needs them; Expo Go shows Plan A's photo.
  if (canTrackFace && !recipe) {
    return (
      <RecipeStatus
        loading={query.isPending && Boolean(apiUrl)}
        message={finishStatusMessage({
          hasApi: Boolean(apiUrl),
          isMissing: recipe === null,
          isError: query.isError,
        })}
        onRetry={
          query.isError
            ? () => {
                void query.refetch();
              }
            : undefined
        }
      />
    );
  }
  const layers = recipeLayers(id, finishLayers(recipe?.steps ?? []));
  const fade = (
    <View
      pointerEvents="none"
      // eslint-disable-next-line better-tailwindcss/no-restricted-classes -- The gradient is sized to the Plan A photo composition.
      className="absolute inset-x-0 bottom-0 h-[45.4%]"
      style={{
        backgroundImage:
          'linear-gradient(to bottom, rgba(255,250,252,0) 0%, rgba(255,250,252,0.92) 35%, #fffafc 100%)',
      }}
    />
  );
  const sparkles = (
    <Image
      accessible={false}
      pointerEvents="none"
      source={finishSparkles}
      contentFit="fill"
      style={{ position: 'absolute', width: '100%', height: '100%' }}
    />
  );
  return (
    <MediaLayout
      media={
        <>
          {canTrackFace ? (
            <FaceMakeupCamera layers={layers}>
              {fade}
              {sparkles}
            </FaceMakeupCamera>
          ) : (
            <FaceScene photo={arPhotos.finished}>
              {fade}
              {sparkles}
            </FaceScene>
          )}
        </>
      }
      header={
        <View className="flex-row justify-between px-4" style={{ paddingTop: insets.top + 8 }}>
          <GlassIconButton
            icon={CLOSE}
            label="閉じる"
            onPress={() => {
              backOrHome();
            }}
          />
          {/* Plan A ⑩ has only 保存 here and no way to ⑪, which Plan A hides. 共有 is added
            beside it (#95) and shares text only, never the camera image. */}
          <View className="flex-row gap-2">
            <GlassIconButton
              icon={SHARE}
              label="共有"
              {...(recipe
                ? {
                    onPress: () => {
                      shareRecipe(recipe, '試しました');
                    },
                  }
                : {})}
            />
            <GlassIconButton icon={DOWNLOAD} label="写真を保存（準備中）" />
          </View>
        </View>
      }
      footer={
        <View className="items-center gap-3.5 px-5" style={{ paddingBottom: insets.bottom + 12 }}>
          <Text
            accessibilityRole="header"
            className="font-maru-black text-match-score text-accent-rose"
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
            className="min-h-13 w-full flex-row items-center justify-center gap-1.5 rounded-full border border-line-soft bg-white px-4.5 active:opacity-70"
          >
            <Image accessible={false} source={sparkleInk} style={{ width: 20, height: 20 }} />
            <Text className="font-maru-bold text-action text-ink-primary">次のメイクを試す？</Text>
          </Pressable>
        </View>
      }
    />
  );
}

function finishStatusMessage({
  hasApi,
  isMissing,
  isError,
}: {
  hasApi: boolean;
  isMissing: boolean;
  isError: boolean;
}) {
  if (!hasApi) {
    return '接続先が未設定です。セットアップ後に表示できます。';
  }
  if (isMissing) {
    return 'レシピが見つかりません';
  }
  if (isError) {
    return 'レシピを読み込めませんでした。通信状況を確認してお試しください。';
  }
  return 'レシピを読み込んでいます';
}
