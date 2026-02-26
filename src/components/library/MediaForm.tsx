import React from 'react';
import { MEDIA_TYPES, MEDIA_STATUSES, getMetadataFields } from '@/utils/mediaHelpers';
import type { MediaMetadata, MediaType, MediaStatus } from '@/types';
import { RatingInput } from './RatingInput';
import { CoverUpload } from './CoverUpload';
import type { UseLibraryFormReturn } from '@/hooks/useLibraryForm';
import styles from './LibraryPage.module.css';

interface MediaFormProps {
  form: UseLibraryFormReturn;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
}

export function MediaForm({ form, onSave, onCancel, saveLabel }: MediaFormProps) {
  return (
    <div className={styles.formContainer}>
      <div className={styles.formStack}>
        {/* Row 1: Type + Title */}
        <div className={styles.formRow}>
          <select value={form.formType} onChange={e => form.handleFormTypeChange(e.target.value as MediaType)} className={`edit-modal-input ${styles.formSelect}`}>
            {MEDIA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="text" value={form.formTitle} onChange={e => form.setFormTitle(e.target.value)}
            placeholder="Title..." className={`edit-modal-input ${styles.formInput}`}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
          />
        </div>

        {/* Row 2: Status + Date Finished */}
        <div className={styles.formRow}>
          <select value={form.formStatus} onChange={e => form.setFormStatus(e.target.value as MediaStatus | '')} className={`edit-modal-input ${styles.formSelect}`}>
            <option value="">No status</option>
            {MEDIA_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" value={form.formDateFinished} onChange={e => form.setFormDateFinished(e.target.value)} className={`edit-modal-input ${styles.formInput}`} title="Date finished" />
        </div>

        {/* Row 3: Rating */}
        <div className={styles.formRowCenter}>
          <span className={styles.formLabel}>RATING</span>
          <RatingInput value={form.formRating} onChange={form.setFormRating} />
        </div>

        {/* Row 4: Cover image */}
        <CoverUpload
          variant="inline"
          coverUrl={form.formCoverUrl}
          onCoverUrlChange={form.setFormCoverUrl}
          onFileUpload={form.handleFileUpload}
          fileInputRef={form.fileInputRef}
          isUploading={form.isUploading}
          isLoggedIn={form.cloudSync.isLoggedIn}
        />

        {/* Row 5: Per-type metadata fields */}
        {getMetadataFields(form.formType).length > 0 && (
          <div className={styles.formMetaSection}>
            <span className={styles.formMetaLabel}>
              {form.formType.toUpperCase()} DETAILS
            </span>
            <div className={styles.formMetaGrid}>
              {getMetadataFields(form.formType).map(field => (
                <div key={field.key} className={styles.formMetaField}>
                  <label className={styles.formMetaFieldLabel}>{field.label}</label>
                  <input
                    type={field.inputType}
                    value={(form.formMetadata[field.key] as string | number) ?? ''}
                    onChange={e => form.updateMetaField(field.key, field.inputType === 'number' ? (e.target.value ? Number(e.target.value) : '') as unknown as number : e.target.value)}
                    className="edit-modal-input"
                    style={{ padding: '4px 8px', fontSize: 11 }}
                    placeholder={field.label}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Row 6: Notion URL */}
        <input type="text" value={form.formNotionUrl} onChange={e => form.setFormNotionUrl(e.target.value)} placeholder="Notion URL (optional)..." className={`edit-modal-input ${styles.formInput}`} />

        {/* Row 7: Notes */}
        <textarea
          value={form.formNotes}
          onChange={e => form.setFormNotes(e.target.value)}
          placeholder="Notes, thoughts, review..."
          className={`edit-modal-input ${styles.formTextarea}`}
        />

        {/* Actions */}
        <div className={styles.formActions}>
          <button onClick={onCancel} className={`btn-action btn-action-secondary ${styles.formBtnSmall}`}>CANCEL</button>
          <button onClick={onSave} disabled={!form.formTitle.trim()} className={`btn-action btn-action-primary ${styles.formBtnSmall}`}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}
