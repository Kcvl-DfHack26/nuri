import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
  isAvailableAsync,
} from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

// The login screen is light only (Plan A), so Apple's black button is always used.
export function AppleButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const [available, setAvailable] = useState(false);
  const { fontScale } = useWindowDimensions();
  const height = Math.max(52, 48 * fontScale);
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
    <View
      pointerEvents={disabled ? 'none' : 'auto'}
      style={{
        opacity: disabled ? 0.5 : 1,
        borderRadius: height / 2,
        boxShadow: '0px 8px 10px rgba(196, 61, 112, 0.25)',
      }}
    >
      <AppleAuthenticationButton
        accessibilityLabel="Appleで続ける"
        accessibilityState={{ disabled }}
        buttonType={AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={height / 2}
        style={{ width: '100%', height }}
        onPress={() => {
          if (!disabled) {
            onPress();
          }
        }}
      />
    </View>
  );
}
