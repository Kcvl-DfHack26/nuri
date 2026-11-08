import type { LayoutChangeEvent } from 'react-native';

import { useState } from 'react';

export function useLayoutSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  function onLayout({ nativeEvent: { layout } }: LayoutChangeEvent) {
    const { width, height } = layout;
    setSize((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  }

  return { ...size, onLayout };
}

/** Leave enough room for both the media and the controls before putting them side by side. */
export function hasRoomForSidePanel(width: number, height: number) {
  return width >= 680 && width > height;
}

export const cardGridInset = 16;
export const cardGridGap = 8;
const minimumCardWidth = 156;

export function cardGrid(width: number) {
  const available = Math.max(0, width - cardGridInset * 2);
  const columns =
    width === 0
      ? 2
      : Math.max(1, Math.floor((available + cardGridGap) / (minimumCardWidth + cardGridGap)));
  const cardWidth = Math.floor((available - cardGridGap * (columns - 1)) / columns);

  // Before the first measurement, keep the existing two-column layout.
  return { columns, cardWidth: width === 0 ? ('48%' as const) : cardWidth };
}
