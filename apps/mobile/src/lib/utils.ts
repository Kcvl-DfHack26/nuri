import type { ClassValue } from 'clsx';

import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Register global.css typography tokens so they never replace text color utilities.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ['body', 'caption', 'title'] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
