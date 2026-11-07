import { useLocalSearchParams } from 'expo-router';

import { PostStepEdit } from '@/components/post-step';

export default function PostStepScreen() {
  const { index } = useLocalSearchParams<{ index: string }>();
  return <PostStepEdit index={index} />;
}
