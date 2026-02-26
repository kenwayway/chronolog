import React from 'react';
import { Star, ExternalLink } from 'lucide-react';
import { getMetadataFields, getStatusColor } from '@/utils/mediaHelpers';
import type { MediaItem } from '@/types';
import styles from './MediaDetailView.module.css';

interface MetadataTableProps {
  item: MediaItem;
}

export function MetadataTable({ item }: MetadataTableProps) {
  const metaFields = getMetadataFields(item.mediaType);
  const meta = item.metadata || {};

  return (
    <div className={styles.metaTable}>
      {/* Rating row */}
      {item.rating && (
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>RATING</span>
          <div className={styles.ratingValue}>
            <Star size={11} fill="var(--accent)" stroke="var(--accent)" />
            <span className={styles.ratingNumber}>{item.rating}</span>
          </div>
        </div>
      )}
      {/* Status row */}
      {item.status && (
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>STATUS</span>
          <span className={styles.statusBadge} style={{ backgroundColor: getStatusColor(item.status) }}>
            {item.status.toUpperCase()}
          </span>
        </div>
      )}
      {/* Meta fields */}
      {metaFields.map(field => {
        const val = meta[field.key];
        if (val === undefined || val === '' || val === 0) return null;
        return (
          <div key={field.key} className={styles.metaRow}>
            <span className={styles.metaLabel}>{field.label.toUpperCase()}</span>
            <span className={styles.metaValue}>{String(val)}</span>
          </div>
        );
      })}
      {item.dateFinished && (
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>FINISHED</span>
          <span className={styles.metaValue}>{item.dateFinished}</span>
        </div>
      )}
      {/* Notion link row */}
      {item.notionUrl && (
        <a href={item.notionUrl} target="_blank" rel="noopener noreferrer" className={styles.notionLink}>
          <ExternalLink size={10} />
          OPEN IN NOTION
        </a>
      )}
    </div>
  );
}
