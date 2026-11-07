import { useLocalSearchParams } from 'expo-router';

import { PartList } from '@/components/part-list';

export default function PartScreen() {
  const { part } = useLocalSearchParams<{ part: string }>();
  return <PartList part={part} />;
}
