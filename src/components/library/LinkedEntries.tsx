import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownRight } from 'lucide-react';
import { useSessionContext } from '@/contexts/SessionContext';
import { useUIStateContext } from '@/hooks/useUIStateContext';
import { findLinkedEntries, getEntryPreview } from '@/utils/mediaHelpers';
import { extractImages, thumbUrl } from '@/utils/imageExtractor';
import { formatDate, formatTime } from '@/utils/formatters';
import styles from './MediaDetailView.module.css';

/** Thumbnails shown inline per entry before collapsing into a "+N" */
const MAX_THUMBS = 3;

interface LinkedEntriesProps {
  mediaId: string;
  /** Closes the detail overlay before jumping away from the library */
  onNavigateAway: () => void;
}

/**
 * Timeline entries that reference this media item. The library is a list of
 * what you watched; this is the part that says when, and what you were
 * writing about at the time.
 */
export function LinkedEntries({ mediaId, onNavigateAway }: LinkedEntriesProps) {
  const navigate = useNavigate();
  const ui = useUIStateContext();
  const { timelineItems } = useSessionContext();

  const linked = useMemo(
    () => findLinkedEntries(timelineItems, mediaId).map(entry => ({
      entry,
      // extractImages already knows the 🖼️ line format — reuse it per entry
      // rather than re-parsing content here. Kept unsliced so the "+N" overflow
      // count reflects every image, not just the ones we kept.
      images: extractImages([entry]),
    })),
    [timelineItems, mediaId]
  );

  const jumpToEntry = (entryId: string) => {
    const entry = linked.find(l => l.entry.id === entryId)?.entry;
    if (!entry) return;
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
          {linked.map(({ entry, images }) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => jumpToEntry(entry.id)}
                className={styles.linkedItem}
                title="Jump to this entry on the timeline"
              >
                <CornerDownRight size={11} className={styles.linkedIcon} />
                <span className={styles.linkedWhen}>
                  {formatDate(entry.timestamp)} {formatTime(entry.timestamp)}
                </span>
                <span className={styles.linkedText}>{getEntryPreview(entry)}</span>
                {images.length > 0 && (
                  <span className={styles.linkedThumbs}>
                    {images.slice(0, MAX_THUMBS).map((image, i) => (
                      <img
                        key={`${entry.id}-${i}`}
                        src={thumbUrl(image.url)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className={styles.linkedThumb}
                        onError={e => {
                          // Old uploads have no .thumb object — fall back to
                          // the original (once, no retry loop)
                          const img = e.currentTarget;
                          if (img.src.endsWith('.thumb')) img.src = image.url;
                          else img.style.display = 'none';
                        }}
                      />
                    ))}
                    {images.length > MAX_THUMBS && (
                      <span className={styles.linkedThumbMore}>+{images.length - MAX_THUMBS}</span>
                    )}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
