import type { DimensionValue } from 'react-native';

import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import type { RecipeSummary } from '@/lib/recipes';

import { CardFavorite } from '@/components/card-favorite';
import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { apiAssetUrl } from '@/lib/api';
import { formatCount } from '@/lib/recipes';
import { useTokenColor } from '@/theme/tokens';

const HEART = Icon.select({ ios: 'heart', android: import('@expo/material-symbols/favorite.xml') });

export function RecipeCardMetadata({ recipe, likes }: { recipe: RecipeSummary; likes: string }) {
  const secondary = useTokenColor('--color-ink-secondary');
  return (
    <View className="w-full gap-px px-1 pt-0.5">
      <Text className="font-maru-bold text-label text-ink-primary">{recipe.title}</Text>
      <View className="flex-row items-center gap-0.75">
        <Text className="flex-1 font-maru text-meta text-ink-secondary">{recipe.author.name}</Text>
        <SocialIcon name={HEART} size={13} color={secondary} />
        <Text className="font-maru text-meta text-ink-secondary">{likes}</Text>
      </View>
    </View>
  );
}

// Plan A ①'s recipe card in a two-column grid; search results reuse it. Opens the recipe's ⑤.
export function RecipeCard({ recipe, width }: { recipe: RecipeSummary; width: DimensionValue }) {
  const secondary = useTokenColor('--color-ink-secondary');
  const likes = formatCount(recipe.likeCount);
  return (
    <View style={{ width }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${recipe.title}、${recipe.author.name}、お気に入り${likes}`}
        className="gap-1.25 active:opacity-80"
        onPress={() => {
          router.push(`/recipes/${recipe.id}`);
        }}
      >
        <View className="aspect-192/233 w-full overflow-hidden rounded-compact bg-neutral-soft">
          <Image
            accessible={false}
            source={{ uri: apiAssetUrl(recipe.image) }}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </View>
        <View className="w-full gap-1.25 px-2">
          <Text className="font-maru-bold text-label text-ink-primary">{recipe.title}</Text>
          <View className="flex-row items-center gap-1">
            <Text className="flex-1 font-maru text-meta text-ink-secondary">
              {recipe.author.name}
            </Text>
            <SocialIcon name={HEART} webGlyph="♡" size={14} color={secondary} />
            <Text className="font-maru text-meta text-ink-secondary">{likes}</Text>
          </View>
        </View>
      </Pressable>
      <CardFavorite
        recipe={recipe}
        title={recipe.title}
        iconSize={18}
        className="right-2 top-2 size-8 bg-white"
      />
    </View>
  );
}
