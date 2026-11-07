import { useLocalSearchParams } from 'expo-router';

import { ProductSheet } from '@/components/product-sheet';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductSheet id={id} />;
}
