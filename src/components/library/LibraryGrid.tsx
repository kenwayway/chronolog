import React from 'react';
import type { LibrarySection } from '@/utils/mediaHelpers';
import { MediaCard } from './MediaCard';
import { MediaForm } from './MediaForm';
import type { UseLibraryFormReturn } from '@/hooks/useLibraryForm';
import styles from './LibraryPage.module.css';

interface LibraryGridProps {
  sections: LibrarySection[];
  totalCount: number;
  form: UseLibraryFormReturn;
}

export function LibraryGrid({ sections, totalCount, form }: LibraryGridProps) {
  if (sections.length === 0) {
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
      {sections.map(section => (
        <div key={section.key} className={styles.sectionGroup}>
          {/* Section header */}
          <div className={styles.sectionHeader}>
            {section.icon}
            <span>{section.label}</span>
            <span className={styles.sectionCount}>&middot; {section.items.length}</span>
            <div className={styles.sectionLine} />
          </div>

          {/* Cards grid */}
          <div className={styles.cardsGrid}>
            {section.items.map(item => {
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
