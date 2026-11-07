import { useLocalSearchParams } from 'expo-router';

import { MakeCompare } from '@/components/make-compare';

export default function CompareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MakeCompare id={id} />;
}
