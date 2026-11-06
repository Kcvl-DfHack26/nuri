import { useLocalSearchParams } from 'expo-router';

import { Profile } from '@/components/profile';

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Profile id={id} />;
}
