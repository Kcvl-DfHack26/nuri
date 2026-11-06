import { Image, useColorScheme, useWindowDimensions } from 'react-native';

import { Button } from '@/components/ui/button';

import whiteButton from '../../assets/auth/apple-sign-in-white.png';
import blackButton from '../../assets/auth/apple-sign-in.png';

export function AppleButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const dark = useColorScheme() === 'dark';
  const { fontScale } = useWindowDimensions();
  return (
    <Button
      accessibilityLabel="Appleでサインイン"
      disabled={disabled}
      onPress={onPress}
      className="w-full rounded-xl p-0"
      style={{
        backgroundColor: dark ? '#ffffff' : '#000000',
        minHeight: Math.max(56, 48 * fontScale),
      }}
    >
      <Image
        source={dark ? whiteButton : blackButton}
        resizeMode="contain"
        style={{ width: '100%', height: Math.max(56, 48 * fontScale) }}
        accessible={false}
      />
    </Button>
  );
}
