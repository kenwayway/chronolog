import React, { ChangeEvent, RefObject } from 'react';
import { Upload, X, Image } from 'lucide-react';
import styles from './LibraryPage.module.css';
import detailStyles from './MediaDetailView.module.css';

interface CoverUploadProps {
  coverUrl: string;
  onCoverUrlChange: (url: string) => void;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  isUploading: boolean;
  isLoggedIn: boolean;
  /** 'inline' = compact row for MediaForm; 'detail' = detail-edit column layout */
  variant: 'inline' | 'detail';
}

export function CoverUpload({ coverUrl, onCoverUrlChange, onFileUpload, fileInputRef, isUploading, isLoggedIn, variant }: CoverUploadProps) {
  if (variant === 'detail') {
    return (
      <>
        {/* Cover preview */}
        <div className={detailStyles.coverImage}>
          {coverUrl ? (
            <img src={coverUrl} alt="preview" className={detailStyles.coverImg} />
          ) : (
            <div className={detailStyles.coverPlaceholder}>
              <Image size={32} />
            </div>
          )}
        </div>
        {/* Cover URL + Upload */}
        <div className={detailStyles.coverUploadStack}>
          <input type="text" value={coverUrl} onChange={e => onCoverUrlChange(e.target.value)} placeholder="Cover image URL..." className="edit-modal-input" style={{ padding: '5px 8px', fontSize: 10 }} />
          <div className={detailStyles.coverUploadActions}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={`btn-action btn-action-secondary ${detailStyles.coverUploadBtn}`}
              title={isLoggedIn ? 'Upload cover image' : 'Connect cloud sync to upload'}
            >
              <Upload size={11} />
              {isUploading ? '...' : 'UPLOAD'}
            </button>
            {coverUrl && (
              <button
                onClick={() => onCoverUrlChange('')}
                className={`btn-action btn-action-danger ${detailStyles.coverRemoveBtn}`}
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  // variant === 'inline'
  return (
    <>
      <div className={styles.formRowCenter}>
        <input type="text" value={coverUrl} onChange={e => onCoverUrlChange(e.target.value)} placeholder="Cover image URL..." className={`edit-modal-input ${styles.formInput}`} />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onFileUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={`btn-action btn-action-secondary ${styles.uploadBtn}`}
          title={isLoggedIn ? 'Upload cover image' : 'Connect cloud sync to upload'}
        >
          <Upload size={11} />
          {isUploading ? '...' : 'UPLOAD'}
        </button>
      </div>
      {coverUrl && (
        <div className={styles.formPreviewRow}>
          <img src={coverUrl} alt="preview" className={styles.formPreviewImg} />
          <button onClick={() => onCoverUrlChange('')} className={styles.formPreviewClear}><X size={12} /></button>
        </div>
      )}
    </>
  );
}
