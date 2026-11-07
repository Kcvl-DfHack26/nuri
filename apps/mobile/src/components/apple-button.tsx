import { Image, useWindowDimensions } from 'react-native';

import { Button } from '@/components/ui/button';

import continueButton from '../../assets/auth/apple-continue.png';

// The login screen is light only (Plan A), so Apple's black artwork is always used.
export function AppleButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const { fontScale } = useWindowDimensions();
  const height = Math.max(52, 48 * fontScale);
  return (
    <Button
      accessibilityLabel="Appleで続ける"
      disabled={disabled}
      onPress={onPress}
      className="w-full rounded-full bg-black p-0 active:bg-black"
      style={{ minHeight: height, boxShadow: '0px 8px 10px rgba(196, 61, 112, 0.25)' }}
    >
      <Image
        source={continueButton}
        resizeMode="contain"
        style={{ width: '100%', height }}
        accessible={false}
      />
    </Button>
  );
}
