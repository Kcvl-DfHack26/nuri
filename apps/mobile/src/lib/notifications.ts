import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

import { apiUrl } from '@/lib/api';

export const pushAvailable =
  (Platform.OS === 'ios' || Platform.OS === 'android') && !isRunningInExpoGo() && Boolean(apiUrl);

// Expo Go and web still load the app without starting the native push module.
export const loadNotifications = () => import('expo-notifications');
