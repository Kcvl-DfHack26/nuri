import type { ReactNode } from 'react';

/** On native, the step uses the face tracker or its sample preview. */
export function useStepCamera(): { preview?: ReactNode; control?: ReactNode } {
  return {};
}
