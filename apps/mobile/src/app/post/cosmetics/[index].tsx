import { useLocalSearchParams } from 'expo-router';

import { PostCosmeticPicker } from '@/components/post-step';

export default function PostCosmeticsScreen() {
  const { index } = useLocalSearchParams<{ index: string }>();
  return <PostCosmeticPicker index={index} />;
}
