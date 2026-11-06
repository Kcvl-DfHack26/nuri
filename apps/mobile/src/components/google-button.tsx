import { Image } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

import googleLogo from '../../assets/auth/google.png';

export function GoogleButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <Button
      variant="outline"
      disabled={disabled}
      onPress={onPress}
      className="min-h-14 w-full flex-row gap-3 rounded-xl px-4 py-3"
      style={{ backgroundColor: '#ffffff', borderColor: '#747775' }}
    >
      <Image
        source={googleLogo}
        resizeMode="contain"
        style={{ width: 20, height: 20 }}
        accessible={false}
      />
      <Text className="shrink text-center font-medium" style={{ color: '#1f1f1f' }}>
        Googleでログイン
      </Text>
    </Button>
  );
}
