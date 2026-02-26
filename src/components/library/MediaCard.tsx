import React, { memo } from 'react';
import { Image, Star } from 'lucide-react';
import type { MediaItem } from '@/types';
import styles from './LibraryPage.module.css';

interface MediaCardProps {
  item: MediaItem;
  isDeleting: boolean;
  onClick: () => void;
}

export const MediaCard = memo(function MediaCard({ item, isDeleting, onClick }: MediaCardProps) {
  return (
    <div
      className={`${styles.card} ${isDeleting ? styles.cardDeleting : ''}`}
      onClick={onClick}
    >
      {/* Cover image */}
      <div className={styles.cardCover}>
        {item.coverUrl ? (
          <img src={item.coverUrl} alt={item.title} className={styles.cardCoverImg} />
        ) : (
          <div className={styles.cardCoverPlaceholder}>
            <Image size={20} />
          </div>
        )}
      </div>

      {/* Card body */}
      <div className={styles.cardBody}>
        <div className={styles.cardTitle}>{item.title}</div>
        <div className={styles.cardMeta}>
          {item.metadata?.director && <span>{item.metadata.director}</span>}
          {item.metadata?.author && <span>{item.metadata.author}</span>}
          {item.metadata?.developer && <span>{item.metadata.developer}</span>}
          {item.metadata?.host && <span>{item.metadata.host}</span>}
          {item.metadata?.year && <span>&middot; {item.metadata.year}</span>}
          {item.rating && (
            <span className={styles.cardRating}>
              <Star size={8} fill="var(--accent)" stroke="var(--accent)" />
              {item.rating}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
