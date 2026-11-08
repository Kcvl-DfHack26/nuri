import { Image } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

import googleLogo from '../../assets/auth/google.png';

// Google's light button: white fill, #747775 stroke, #1f1f1f label and the full-color logo.
export function GoogleButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <Button
      variant="outline"
      disabled={disabled}
      onPress={onPress}
      className="min-h-13 w-full flex-row gap-3 rounded-full px-4.5 py-3"
      style={{ backgroundColor: '#ffffff', borderColor: '#747775' }}
    >
      <Image
        source={googleLogo}
        resizeMode="contain"
        style={{ width: 20, height: 20 }}
        accessible={false}
      />
      <Text className="shrink text-center font-medium" style={{ color: '#1f1f1f' }}>
        Googleで続ける
      </Text>
    </Button>
  );
}
