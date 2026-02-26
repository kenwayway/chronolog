import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useLibraryForm } from '@/hooks/useLibraryForm';
import {
  LibraryHeader,
  LibraryGrid,
  MediaForm,
  MediaDetailView,
  DeleteConfirmModal,
} from '@/components/library';
import styles from '@/components/library/LibraryPage.module.css';

/**
 * LibraryPage — standalone page showing all media items as cards grouped by type
 */
export function LibraryPage() {
  const navigate = useNavigate();
  const form = useLibraryForm();

  const expandedItem = form.expandedId
    ? form.mediaItems.find(i => i.id === form.expandedId)
    : null;

  return (
    <div className={styles.page}>
      {/* Header */}
      <LibraryHeader
        totalCount={form.mediaItems.length}
        searchQuery={form.searchQuery}
        onSearchChange={form.setSearchQuery}
        onBack={() => navigate('/')}
        onAdd={form.startCreate}
      />

      {/* Create form */}
      {form.isCreating && (
        <div className={styles.createFormWrapper}>
          <div className={styles.createFormHeader}>
            <span className={styles.createFormLabel}>NEW MEDIA</span>
            <button onClick={() => form.setIsCreating(false)} className={styles.createFormClose}>
              <X size={14} />
            </button>
          </div>
          <MediaForm
            form={form}
            onSave={form.handleCreate}
            onCancel={() => form.setIsCreating(false)}
            saveLabel="CREATE"
          />
        </div>
      )}

      {/* Content: grouped by type */}
      <LibraryGrid
        grouped={form.grouped}
        totalCount={form.mediaItems.length}
        form={form}
      />

      {/* Delete confirmation modal */}
      {form.deleteConfirmId && (
        <DeleteConfirmModal
          onCancel={() => form.setDeleteConfirmId(null)}
          onConfirm={() => form.handleDelete(form.deleteConfirmId!)}
        />
      )}

      {/* Full-screen detail */}
      {expandedItem && (
        <MediaDetailView item={expandedItem} form={form} />
      )}
    </div>
  );
}
