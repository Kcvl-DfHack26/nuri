import { useLocalSearchParams } from 'expo-router';

import { SnsImport } from '@/components/sns-import';

export default function ImportScreen() {
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  return <SnsImport saved={saved === '1'} />;
}
