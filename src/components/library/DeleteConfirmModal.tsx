import React from 'react';
import styles from './LibraryPage.module.css';

interface DeleteConfirmModalProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({ onCancel, onConfirm }: DeleteConfirmModalProps) {
  return (
    <div className={styles.deleteOverlay}>
      <div className={styles.deleteModal}>
        <div className={styles.deleteTitle}>DELETE MEDIA</div>
        <div className={styles.deleteMessage}>
          Are you sure you want to delete this item? This cannot be undone.
        </div>
        <div className={styles.deleteActions}>
          <button onClick={onCancel} className={`btn-action btn-action-secondary ${styles.deleteBtnSize}`}>CANCEL</button>
          <button onClick={onConfirm} className={`btn-action btn-action-danger ${styles.deleteBtnSize}`}>DELETE</button>
        </div>
      </div>
    </div>
  );
}
