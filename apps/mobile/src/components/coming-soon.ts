import { Alert, Platform } from 'react-native';

/** Tells people that a feature shown in Plan A is not built yet, e.g. `showComingSoon('購入先')`. */
export function showComingSoon(feature: string) {
  const message = `${feature}は、いま準備しています。`;
  // react-native-web's Alert does nothing, and the review build also runs on the web.
  if (Platform.OS === 'web') {
    window.alert(`準備中\n${message}`);
    return;
  }
  Alert.alert('準備中', message);
}
