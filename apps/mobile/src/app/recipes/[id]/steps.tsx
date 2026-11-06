import { useLocalSearchParams } from 'expo-router';

import { ArSteps } from '@/components/ar-steps';

export default function StepsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ArSteps id={id} />;
}
