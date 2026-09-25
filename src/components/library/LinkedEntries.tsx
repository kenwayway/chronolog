import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useSessionContext } from '@/contexts/SessionContext';
import { useUIStateContext } from '@/hooks/useUIStateContext';
import { findLinkedEntries } from '@/utils/mediaHelpers';
import { formatDate, formatTime, formatDuration } from '@/utils/formatters';
import { ContentRenderer } from '@/components/timeline/ContentRenderer';
import { ImageLightbox } from '@/components/common/ImageLightbox';
import type { TimelineItem } from '@/types';
import styles from './MediaDetailView.module.css';

interface LinkedEntriesProps {
  mediaId: string;
  /** Closes the detail overlay before jumping away from the library */
  onNavigateAway: () => void;
}

/**
 * Every timeline entry about this media item, oldest first and in full. The
 * library is a list of what you watched; this is the part that says when, and
 * what you were writing about at the time.
 */
export function LinkedEntries({ mediaId, onNavigateAway }: LinkedEntriesProps) {
  const navigate = useNavigate();
  const ui = useUIStateContext();
  const { timelineItems } = useSessionContext();
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const linked = useMemo(
    () => findLinkedEntries(timelineItems, mediaId),
    [timelineItems, mediaId]
  );

  const jumpToEntry = (entry: TimelineItem) => {
    onNavigateAway();
    navigate('/');
    ui.navigateToEntry(entry);
  };

  return (
    <div className={styles.linkedSection}>
      <div className={styles.notesHeader}>
        <span>LOGS</span>
        {linked.length > 0 && <span className={styles.linkedCount}>&middot; {linked.length}</span>}
        <div className={styles.notesLine} />
      </div>

      {linked.length === 0 ? (
        <span className={styles.notesEmpty}>No logs reference this yet.</span>
      ) : (
        <ul className={styles.linkedList}>
          {linked.map(({ entry, nested, durationMs }) => (
            <li
              key={entry.id}
              className={`${styles.linkedEntry} ${nested ? styles.linkedNested : ''}`}
            >
              <div className={styles.linkedEntryHead}>
                <span className={styles.linkedWhen}>
                  {entry.kind === 'session-end' && (
                    <span className={styles.linkedEndMark} aria-hidden="true">↳ </span>
                  )}
                  {formatDate(entry.timestamp)} {formatTime(entry.timestamp)}
                  {durationMs !== undefined && (
                    <span className={styles.linkedDuration}>
                      {' '}&middot; {formatDuration(durationMs)}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => jumpToEntry(entry)}
                  className={styles.linkedJump}
                  title="Jump to this entry on the timeline"
                >
                  <span className={styles.linkedJumpLabel}>TIMELINE</span>
                  <ArrowUpRight size={11} className={styles.linkedJumpIcon} />
                </button>
              </div>

              {entry.content.trim() && (
                <div className={styles.linkedBody}>
                  <ContentRenderer content={entry.content} onImageClick={setLightboxImage} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {lightboxImage && (
        <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}
    </div>
  );
}
