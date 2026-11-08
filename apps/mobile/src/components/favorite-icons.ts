import { Icon } from '@expo/ui';

/** The hearts of a favorite, empty and kept, for the card and bottom-bar buttons (#191). */
export const HEART = Icon.select({
  ios: 'heart',
  android: import('@expo/material-symbols/favorite.xml'),
});

// @expo/material-symbols ships outlined symbols only; the filled heart is Material Symbols'
// favorite with FILL 1 (Apache-2.0), added with its `add-material-symbols` CLI.
export const HEART_FILLED = Icon.select({
  ios: 'heart.fill',
  android: import('../../assets/icons/favorite_fill.xml'),
});
