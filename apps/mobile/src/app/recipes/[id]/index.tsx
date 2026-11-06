import { useLocalSearchParams } from 'expo-router';

import { RecipeDetail } from '@/components/recipe-detail';

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecipeDetail id={id} />;
}
