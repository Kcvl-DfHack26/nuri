import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
  isAvailableAsync,
} from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { useColorScheme, useWindowDimensions, View } from 'react-native';

export function AppleButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const [available, setAvailable] = useState(false);
  const dark = useColorScheme() === 'dark';
  const { fontScale } = useWindowDimensions();
  useEffect(() => {
    void isAvailableAsync()
      .then(setAvailable)
      .catch(() => {
        setAvailable(false);
      });
  }, []);
  if (!available) {
    return null;
  }
  return (
    <View pointerEvents={disabled ? 'none' : 'auto'} style={{ opacity: disabled ? 0.5 : 1 }}>
      <AppleAuthenticationButton
        accessibilityLabel="Appleでサインイン"
        accessibilityState={{ disabled }}
        buttonType={AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={
          dark ? AppleAuthenticationButtonStyle.WHITE : AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={12}
        style={{ width: '100%', height: Math.max(56, 48 * fontScale) }}
        onPress={() => {
          if (!disabled) {
            onPress();
          }
        }}
      />
    </View>
  );
}
