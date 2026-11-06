import { router } from 'expo-router';

import { RecipeDetail } from '@/components/recipe-detail';

// ⑫-8 previews the post as the sample recipe it becomes.
export default function PostPreviewScreen() {
  return (
    <RecipeDetail
      id="fox"
      onPost={() => {
        router.push('/post/done');
      }}
    />
  );
}
