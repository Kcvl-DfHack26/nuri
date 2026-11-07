import { Icon } from '@expo/ui';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import type { RecipeSummary } from '@/lib/recipes';

import { SocialIcon } from '@/components/social-icon';
import { Text } from '@/components/ui/text';
import { apiAssetUrl } from '@/lib/api';
import { formatCount } from '@/lib/recipes';
import { useTokenColor } from '@/theme/tokens';

const HEART = Icon.select({ ios: 'heart', android: import('@expo/material-symbols/favorite.xml') });

// Plan A ①'s recipe card in a two-column grid; search results reuse it. Opens the recipe's ⑤.
export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
  const secondary = useTokenColor('--color-ink-secondary');
  const ink = useTokenColor('--color-ink-primary');
  const likes = formatCount(recipe.likeCount);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}、${recipe.author.name}、いいね${likes}`}
      // Half of the row, so a lone last card keeps the grid's width.
      className="max-w-[50%] flex-1 gap-[5px] active:opacity-80"
      onPress={() => {
        router.push(`/recipes/${recipe.id}`);
      }}
    >
      <View className="aspect-[192/233] w-full overflow-hidden rounded-[5px] bg-neutral-soft">
        <Image
          accessible={false}
          source={{ uri: apiAssetUrl(recipe.image) }}
          contentFit="cover"
          style={{ width: '100%', height: '100%' }}
        />
        <View className="absolute right-2 top-2 size-8 items-center justify-center rounded-full bg-white">
          <SocialIcon name={HEART} size={18} color={ink} />
        </View>
      </View>
      <View className="w-full gap-[5px] px-2">
        <Text className="font-maru-bold text-label text-ink-primary">{recipe.title}</Text>
        <View className="flex-row items-center gap-1">
          <Text className="flex-1 font-maru text-meta text-ink-secondary">
            {recipe.author.name}
          </Text>
          <SocialIcon name={HEART} size={14} color={secondary} />
          <Text className="font-maru text-meta text-ink-secondary">{likes}</Text>
        </View>
      </View>
    </Pressable>
  );
}
