import { useLocalSearchParams } from 'expo-router';

import { MakeFinish } from '@/components/make-finish';

export default function FinishScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MakeFinish id={id} />;
}
