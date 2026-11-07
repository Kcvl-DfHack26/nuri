import { router } from 'expo-router';

import type { RecipeDetail } from '@/lib/recipes';

import { usedCosmetics, usePostDraft } from '@/components/post-draft';
import { RecipeContent } from '@/components/recipe-detail';

// The post is not saved anywhere yet, so the preview shows a local sample instead of the API.
const sample: RecipeDetail = {
  id: 'fox',
  title: '狐メイク',
  image: '',
  tags: ['丸顔向け'],
  durationMinutes: 15,
  likeCount: 1200,
  source: 'instagram',
  part: null,
  summary: null,
  author: { id: 'preview', name: 'mio', image: null },
  favorited: false,
  products: [],
  steps: [],
};

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
    <RecipeContent
      recipe={sample}
      steps={draft.steps}
      postedCosmetics={cosmetics}
      onPost={() => {
        router.push('/post/done');
      }}
    />
  );
}
