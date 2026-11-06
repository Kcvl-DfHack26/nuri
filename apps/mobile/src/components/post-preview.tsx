import { router } from 'expo-router';

import { usedCosmetics, usePostDraft } from '@/components/post-draft';
import { RecipeDetail } from '@/components/recipe-detail';

// Plan A ⑫-8 投稿のプレビュー: the sample recipe screen with the draft's cosmetics, hidden
// when the post does not publish them.
export function PostPreview() {
  const { draft } = usePostDraft();
  const cosmetics = draft.publishCosmetics
    ? usedCosmetics(draft.steps).map((cosmetic) => ({
        id: cosmetic.id,
        name: cosmetic.name,
        detail: `${cosmetic.category}・${cosmetic.shade}`,
        color: cosmetic.color,
      }))
    : null;
  return (
    <RecipeDetail
      id="fox"
      postedCosmetics={cosmetics}
      onPost={() => {
        router.push('/post/done');
      }}
    />
  );
}
