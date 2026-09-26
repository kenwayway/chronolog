import { useMemo } from 'react';
import { useSessionContext } from '@/contexts/SessionContext';
import { findLinkedEntries } from '@/utils/mediaHelpers';
import type { LinkedEntry } from '@/utils/mediaHelpers';

/** Every timeline entry about this media item — shared by the tab count and the list */
export function useLinkedEntries(mediaId: string): LinkedEntry[] {
  const { timelineItems } = useSessionContext();
  return useMemo(
    () => findLinkedEntries(timelineItems, mediaId),
    [timelineItems, mediaId]
  );
}
