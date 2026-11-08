import type { ClassValue } from 'clsx';

import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Keep global.css typography and border widths distinct from color utilities.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'border-w': ['border-fine', 'border-selected'],
    },
    theme: {
      text: [
        'body',
        'caption',
        'title',
        'micro',
        'meta',
        'label',
        'ui',
        'action',
        'heading',
        'headline',
        'display',
        'login-wordmark',
        'match-score',
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
