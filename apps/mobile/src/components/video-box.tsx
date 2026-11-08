import type { ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { useState } from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/utils';

// Plan A's landscape frame until the video's own shape is known.
const defaultAspect = 358 / 190;

/**
 * ⑫ (#181, #186): a box in the video's shape (width / height) across the width it is given. A
 * portrait video is shown no taller than `maxHeight`, narrower and centered.
 */
export function VideoBox({
  aspect,
  maxHeight = 420,
  className,
  children,
}: {
  aspect: number | null;
  maxHeight?: number;
  className?: string;
  children: ReactNode;
}) {
  const [width, setWidth] = useState(0);
  const shape = aspect ?? defaultAspect;
  const height = width > 0 ? Math.min(width / shape, maxHeight) : undefined;
  return (
    <View
      onLayout={(event: LayoutChangeEvent) => {
        setWidth(event.nativeEvent.layout.width);
      }}
      className="w-full items-center"
    >
      <View
        className={cn('overflow-hidden rounded-panel', className)}
        style={
          height === undefined
            ? { width: '100%', aspectRatio: shape }
            : { height, width: height * shape }
        }
      >
        {children}
      </View>
    </View>
  );
}
