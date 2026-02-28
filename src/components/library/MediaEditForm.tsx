import React from 'react';
import { MEDIA_TYPES, MEDIA_STATUSES, getMetadataFields } from '@/utils/mediaHelpers';
import type { MediaType, MediaStatus } from '@/types';
import { RatingInput } from './RatingInput';
import { CoverUpload } from './CoverUpload';
import type { UseLibraryFormReturn } from '@/hooks/useLibraryForm';
import styles from './MediaDetailView.module.css';

interface MediaEditFormProps {
  form: UseLibraryFormReturn;
}

export function MediaEditForm({ form }: MediaEditFormProps) {
  return (
    <div className={styles.detailLayout}>
      {/* LEFT: Live cover preview + upload */}
      <div className={styles.coverColumnEdit}>
        <CoverUpload
          variant="detail"
          coverUrl={form.formCoverUrl}
          onCoverUrlChange={form.setFormCoverUrl}
          onFileUpload={form.handleFileUpload}
          fileInputRef={form.fileInputRef}
          isUploading={form.isUploading}
          isLoggedIn={form.cloudSync.isLoggedIn}
        />
      </div>

      {/* RIGHT: Form fields */}
      <div className={styles.infoColumn}>
        {/* Title */}
        <div className={styles.editTitleSection}>
          <span className={styles.editFieldLabel}>TITLE</span>
          <input
            type="text" value={form.formTitle} onChange={e => form.setFormTitle(e.target.value)}
            placeholder="Title..."
            className={`edit-modal-input ${styles.editTitleInput}`}
            autoFocus
            onKeyDown={e => { if (e.key === 'Escape') form.cancelEdit(); }}
          />
        </div>

        {/* Structured fields */}
        <div className={styles.editFieldsTable}>
          {/* Type */}
          <div className={styles.editFieldRow}>
            <span className={styles.metaLabel}>TYPE</span>
            <select value={form.formType} onChange={e => form.handleFormTypeChange(e.target.value as MediaType)} className={`edit-modal-input ${styles.editFieldSelect}`}>
              {MEDIA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {/* Status */}
          <div className={styles.editFieldRow}>
            <span className={styles.metaLabel}>STATUS</span>
            <select value={form.formStatus} onChange={e => form.setFormStatus(e.target.value as MediaStatus | '')} className={`edit-modal-input ${styles.editFieldSelect}`}>
              <option value="">No status</option>
              {MEDIA_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Date Finished */}
          <div className={styles.editFieldRow}>
            <span className={styles.metaLabel}>FINISHED</span>
            <input type="date" value={form.formDateFinished} onChange={e => form.setFormDateFinished(e.target.value)} className={`edit-modal-input ${styles.editFieldInput}`} />
          </div>
          {/* Rating */}
          <div className={styles.editFieldRow}>
            <span className={styles.metaLabel}>RATING</span>
            <RatingInput value={form.formRating} onChange={form.setFormRating} />
          </div>
          {/* Per-type metadata fields */}
          {getMetadataFields(form.formType).map(field => (
            <div key={field.key} className={styles.editFieldRow}>
              <span className={styles.metaLabel}>{field.label.toUpperCase()}</span>
              <input
                type={field.inputType}
                value={(form.formMetadata[field.key] as string | number) ?? ''}
                onChange={e => form.updateMetaField(field.key, field.inputType === 'number' ? (e.target.value ? Number(e.target.value) : '') as unknown as number : e.target.value)}
                className={`edit-modal-input ${styles.editFieldInput}`}
                placeholder={field.label}
              />
            </div>
          ))}
          {/* Notion URL */}
          <div className={styles.editFieldRow}>
            <span className={styles.metaLabel}>NOTION</span>
            <input type="text" value={form.formNotionUrl} onChange={e => form.setFormNotionUrl(e.target.value)} placeholder="URL (optional)" className={`edit-modal-input ${styles.editFieldInput}`} />
          </div>
          {/* Spotify URL */}
          <div className={styles.editFieldRowLast}>
            <span className={styles.metaLabel}>SPOTIFY</span>
            <input type="text" value={form.formSpotifyUrl} onChange={e => form.setFormSpotifyUrl(e.target.value)} placeholder="URL (optional)" className={`edit-modal-input ${styles.editFieldInput}`} />
          </div>
        </div>

        {/* Notes section */}
        <div className={styles.notesSectionEdit}>
          <div className={styles.notesHeaderEdit}>
            <span>NOTES</span>
            <div className={styles.notesLine} />
          </div>
          <textarea
            value={form.formNotes}
            onChange={e => form.setFormNotes(e.target.value)}
            placeholder="Notes, thoughts, review..."
            className={`edit-modal-input ${styles.editTextarea}`}
          />
        </div>

        {/* Actions */}
        <div className={styles.editActions}>
          <button onClick={() => form.cancelEdit()} className={`btn-action btn-action-secondary ${styles.editBtnSize}`}>CANCEL</button>
          <button onClick={() => form.saveEdit()} disabled={!form.formTitle.trim()} className={`btn-action btn-action-primary ${styles.editBtnSize}`}>SAVE CHANGES</button>
        </div>
      </div>
    </div>
  );
}
