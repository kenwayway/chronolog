import React from 'react';
import { getMediaIcon, getMediaLabel } from '@/utils/mediaHelpers';
import type { MediaItem } from '@/types';
import { MediaCard } from './MediaCard';
import { MediaForm } from './MediaForm';
import type { UseLibraryFormReturn } from '@/hooks/useLibraryForm';
import styles from './LibraryPage.module.css';

interface LibraryGridProps {
  grouped: Record<string, MediaItem[]>;
  totalCount: number;
  form: UseLibraryFormReturn;
}

export function LibraryGrid({ grouped, totalCount, form }: LibraryGridProps) {
  const entries = Object.entries(grouped);

  if (entries.length === 0) {
    return (
      <div className={styles.content}>
        <div className={styles.emptyState}>
          {totalCount === 0 ? 'No media items yet.' : 'No matches found.'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.content}>
      {entries.map(([type, items]) => (
        <div key={type} className={styles.sectionGroup}>
          {/* Section header */}
          <div className={styles.sectionHeader}>
            {getMediaIcon(type, 12)}
            <span>{getMediaLabel(type)}</span>
            <span className={styles.sectionCount}>&middot; {items.length}</span>
            <div className={styles.sectionLine} />
          </div>

          {/* Cards grid */}
          <div className={styles.cardsGrid}>
            {items.map(item => {
              const isEditingThis = form.editingId === item.id && form.expandedId !== item.id;
              return (
                <React.Fragment key={item.id}>
                  {isEditingThis ? (
                    <div className={styles.cardEditSpan}>
                      <MediaForm
                        form={form}
                        onSave={form.saveEdit}
                        onCancel={form.cancelEdit}
                        saveLabel="SAVE"
                      />
                    </div>
                  ) : (
                    <MediaCard
                      item={item}
                      isDeleting={form.deleteConfirmId === item.id}
                      onClick={() => form.setExpandedId(form.expandedId === item.id ? null : item.id)}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
