import React, { useMemo, useState, useRef, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Book, Film, Gamepad2, Tv, Clapperboard, Mic, ExternalLink, Pencil, Trash2, X, Plus, Search, Image, Upload, Star } from 'lucide-react';
import { useSessionContext } from '@/contexts/SessionContext';
import { useCloudSyncContext } from '@/contexts/CloudSyncContext';
import { useTheme } from '@/hooks/useTheme';
import type { MediaItem, MediaType, MediaStatus, MediaMetadata } from '@/types';
import { generateId } from '@/utils/formatters';

const MEDIA_TYPES: MediaType[] = ['Book', 'Movie', 'Game', 'TV', 'Anime', 'Podcast'];
const MEDIA_STATUSES: MediaStatus[] = ['Planned', 'In Progress', 'Completed', 'Dropped', 'On Hold'];

const getMediaIcon = (mediaType: string, size: number = 16) => {
  const iconProps = { size, strokeWidth: 2 };
  switch (mediaType) {
    case 'Book': return <Book {...iconProps} />;
    case 'Movie': return <Film {...iconProps} />;
    case 'Game': return <Gamepad2 {...iconProps} />;
    case 'TV': return <Tv {...iconProps} />;
    case 'Anime': return <Clapperboard {...iconProps} />;
    case 'Podcast': return <Mic {...iconProps} />;
    default: return <Film {...iconProps} />;
  }
};

const getMediaLabel = (type: string) => {
  const labels: Record<string, string> = {
    'Book': 'BOOKS', 'Movie': 'MOVIES', 'Game': 'GAMES',
    'TV': 'TV SHOWS', 'Anime': 'ANIME', 'Podcast': 'PODCASTS',
  };
  return labels[type] || type.toUpperCase();
};

const getStatusColor = (status?: MediaStatus) => {
  switch (status) {
    case 'Completed': return '#22c55e';
    case 'In Progress': return '#3b82f6';
    case 'Planned': return '#a78bfa';
    case 'On Hold': return '#f59e0b';
    case 'Dropped': return '#ef4444';
    default: return 'var(--text-dim)';
  }
};

/** Get the per-type metadata field definitions for a given media type */
function getMetadataFields(type: MediaType): { key: keyof MediaMetadata; label: string; inputType: 'text' | 'number' | 'date' }[] {
  switch (type) {
    case 'Movie': return [
      { key: 'director', label: 'Director', inputType: 'text' },
      { key: 'year', label: 'Year', inputType: 'number' },
      { key: 'genre', label: 'Genre', inputType: 'text' },
      { key: 'releasedDate', label: 'Released', inputType: 'date' },
    ];
    case 'Book': return [
      { key: 'author', label: 'Author', inputType: 'text' },
      { key: 'genre', label: 'Genre', inputType: 'text' },
    ];
    case 'Game': return [
      { key: 'developer', label: 'Developer', inputType: 'text' },
      { key: 'genre', label: 'Genre', inputType: 'text' },
      { key: 'releasedDate', label: 'Released', inputType: 'date' },
    ];
    case 'TV': return [
      { key: 'season', label: 'Season', inputType: 'number' },
    ];
    case 'Anime': return [
      { key: 'season', label: 'Season', inputType: 'number' },
    ];
    case 'Podcast': return [
      { key: 'host', label: 'Host', inputType: 'text' },
    ];
    default: return [];
  }
}

// Rating dots component
function RatingDisplay({ rating, size = 10 }: { rating?: number; size?: number }) {
  if (!rating) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Star size={size} fill="var(--accent)" stroke="var(--accent)" strokeWidth={2} />
      <span style={{ fontSize: size, fontWeight: 600, color: 'var(--accent)' }}>{rating}</span>
    </div>
  );
}

// Interactive rating input
function RatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? 0 : n)}
          style={{
            width: 18, height: 18, borderRadius: '50%',
            border: n <= value ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
            backgroundColor: n <= value ? 'var(--accent)' : 'transparent',
            cursor: 'pointer', padding: 0,
            transition: 'all 120ms ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, fontWeight: 700, fontFamily: 'var(--font-mono)',
            color: n <= value ? 'var(--bg-primary)' : 'var(--text-dim)',
          }}
          title={`${n}/10`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/**
 * LibraryPage — standalone page showing all media items as cards grouped by type
 */
export function LibraryPage() {
  const navigate = useNavigate();
  const { state: { mediaItems }, actions: { addMediaItem, updateMediaItem, deleteMediaItem } } = useSessionContext();
  const cloudSync = useCloudSyncContext();
  const { tokens } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Edit/create form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<MediaType>('Movie');
  const [formNotionUrl, setFormNotionUrl] = useState('');
  const [formCoverUrl, setFormCoverUrl] = useState('');
  const [formRating, setFormRating] = useState(0);
  const [formStatus, setFormStatus] = useState<MediaStatus | ''>('');
  const [formDateFinished, setFormDateFinished] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formMetadata, setFormMetadata] = useState<MediaMetadata>({});
  const [isUploading, setIsUploading] = useState(false);

  // Filter by search
  const filtered = mediaItems.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by type
  const grouped = useMemo(() => {
    const groups: Record<string, MediaItem[]> = {};
    for (const type of MEDIA_TYPES) {
      const items = filtered.filter(m => m.mediaType === type);
      if (items.length > 0) {
        groups[type] = items.sort((a, b) => b.createdAt - a.createdAt);
      }
    }
    return groups;
  }, [filtered]);

  const resetForm = () => {
    setFormTitle('');
    setFormType('Movie');
    setFormNotionUrl('');
    setFormCoverUrl('');
    setFormRating(0);
    setFormStatus('');
    setFormDateFinished('');
    setFormNotes('');
    setFormMetadata({});
  };

  const startEdit = (item: MediaItem) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormType(item.mediaType);
    setFormNotionUrl(item.notionUrl || '');
    setFormCoverUrl(item.coverUrl || '');
    setFormRating(item.rating || 0);
    setFormStatus(item.status || '');
    setFormDateFinished(item.dateFinished || '');
    setFormNotes(item.notes || '');
    setFormMetadata(item.metadata || {});
    setIsCreating(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const buildMediaItem = (): Partial<Omit<MediaItem, 'id' | 'createdAt'>> => {
    // Clean metadata: only include fields relevant to the current type
    const typeFields = getMetadataFields(formType);
    const cleanMeta: MediaMetadata = {};
    for (const field of typeFields) {
      const val = formMetadata[field.key];
      if (val !== undefined && val !== '' && val !== 0) {
        (cleanMeta as Record<string, unknown>)[field.key] = val;
      }
    }

    return {
      title: formTitle.trim(),
      mediaType: formType,
      notionUrl: formNotionUrl.trim() || undefined,
      coverUrl: formCoverUrl.trim() || undefined,
      rating: formRating || undefined,
      status: (formStatus as MediaStatus) || undefined,
      dateFinished: formDateFinished || undefined,
      notes: formNotes.trim() || undefined,
      metadata: Object.keys(cleanMeta).length > 0 ? cleanMeta : undefined,
    };
  };

  const saveEdit = () => {
    if (!editingId || !formTitle.trim()) return;
    updateMediaItem(editingId, buildMediaItem());
    cancelEdit();
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    resetForm();
  };

  const handleCreate = () => {
    if (!formTitle.trim()) return;
    const item = buildMediaItem();
    addMediaItem({
      id: generateId(),
      title: item.title!,
      mediaType: item.mediaType!,
      notionUrl: item.notionUrl,
      coverUrl: item.coverUrl,
      rating: item.rating,
      status: item.status,
      dateFinished: item.dateFinished,
      notes: item.notes,
      metadata: item.metadata,
      createdAt: Date.now(),
    });
    setIsCreating(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    deleteMediaItem(id);
    setDeleteConfirmId(null);
  };

  // Count by type for stats
  const typeCounts = MEDIA_TYPES.reduce((acc, type) => {
    acc[type] = mediaItems.filter(m => m.mediaType === type).length;
    return acc;
  }, {} as Record<string, number>);

  const updateMetaField = (key: keyof MediaMetadata, value: string | number) => {
    setFormMetadata(prev => ({ ...prev, [key]: value }));
  };

  // Inline edit/create form component
  const renderForm = (onSave: () => void, onCancel: () => void, saveLabel: string) => (
    <div style={{
      padding: 14,
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--accent)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Row 1: Type + Title */}
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={formType} onChange={e => { setFormType(e.target.value as MediaType); setFormMetadata({}); }} className="edit-modal-input" style={{ padding: '5px 8px', fontSize: 11, width: 'auto' }}>
            {MEDIA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Title..." className="edit-modal-input" style={{ flex: 1, padding: '5px 8px', fontSize: 11 }} autoFocus onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }} />
        </div>

        {/* Row 2: Status + Date Finished */}
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={formStatus} onChange={e => setFormStatus(e.target.value as MediaStatus | '')} className="edit-modal-input" style={{ padding: '5px 8px', fontSize: 11, width: 'auto' }}>
            <option value="">No status</option>
            {MEDIA_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" value={formDateFinished} onChange={e => setFormDateFinished(e.target.value)} className="edit-modal-input" style={{ padding: '5px 8px', fontSize: 11, flex: 1 }} title="Date finished" />
        </div>

        {/* Row 3: Rating */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>RATING</span>
          <RatingInput value={formRating} onChange={setFormRating} />
        </div>

        {/* Row 4: Cover image */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="text" value={formCoverUrl} onChange={e => setFormCoverUrl(e.target.value)} placeholder="Cover image URL..." className="edit-modal-input" style={{ flex: 1, padding: '5px 8px', fontSize: 11 }} />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={async (e: ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (!cloudSync.isLoggedIn) {
                alert('Please connect to cloud sync first to upload images.');
                return;
              }
              try {
                setIsUploading(true);
                const url = await cloudSync.uploadImage(file);
                setFormCoverUrl(url);
              } catch (err) {
                alert(`Upload failed: ${(err as Error).message}`);
              } finally {
                setIsUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="btn-action btn-action-secondary"
            style={{ fontSize: 10, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
            title={cloudSync.isLoggedIn ? 'Upload cover image' : 'Connect cloud sync to upload'}
          >
            <Upload size={11} />
            {isUploading ? '...' : 'UPLOAD'}
          </button>
        </div>
        {formCoverUrl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={formCoverUrl} alt="preview" style={{ width: 32, height: 44, objectFit: 'cover', border: '1px solid var(--border-subtle)' }} />
            <button onClick={() => setFormCoverUrl('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, display: 'flex' }}><X size={12} /></button>
          </div>
        )}

        {/* Row 5: Per-type metadata fields */}
        {getMetadataFields(formType).length > 0 && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
              {formType.toUpperCase()} DETAILS
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
              {getMetadataFields(formType).map(field => (
                <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <label style={{ fontSize: 9, color: 'var(--text-dim)' }}>{field.label}</label>
                  <input
                    type={field.inputType}
                    value={(formMetadata[field.key] as string | number) ?? ''}
                    onChange={e => updateMetaField(field.key, field.inputType === 'number' ? (e.target.value ? Number(e.target.value) : '') as unknown as number : e.target.value)}
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
        <input type="text" value={formNotionUrl} onChange={e => setFormNotionUrl(e.target.value)} placeholder="Notion URL (optional)..." className="edit-modal-input" style={{ padding: '5px 8px', fontSize: 11 }} />

        {/* Row 7: Notes */}
        <textarea
          value={formNotes}
          onChange={e => setFormNotes(e.target.value)}
          placeholder="Notes, thoughts, review..."
          className="edit-modal-input"
          style={{ padding: '5px 8px', fontSize: 11, minHeight: 60, resize: 'vertical', fontFamily: 'var(--font-mono)' }}
        />

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 2 }}>
          <button onClick={onCancel} className="btn-action btn-action-secondary" style={{ fontSize: 10, padding: '3px 8px' }}>CANCEL</button>
          <button onClick={onSave} disabled={!formTitle.trim()} className="btn-action btn-action-primary" style={{ fontSize: 10, padding: '3px 8px' }}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );

  // Render immersive full-screen detail — ChronoLog aesthetic
  const renderDetail = (item: MediaItem) => {
    const isEditingThis = editingId === item.id;
    const metaFields = getMetadataFields(item.mediaType);
    const meta = item.metadata || {};

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        animation: 'modalFadeIn 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-mono)',
      }}>
        <style>{`
          @keyframes modalFadeIn {
            from { opacity: 0; transform: scale(1.02); filter: blur(8px); }
            to { opacity: 1; transform: scale(1); filter: blur(0); }
          }
          .story-scroll::-webkit-scrollbar { width: 6px; }
          .story-scroll::-webkit-scrollbar-track { background: transparent; }
          .story-scroll::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 3px; }
          .story-scroll:hover::-webkit-scrollbar-thumb { background: var(--text-dim); }
        `}</style>

        {/* --- Immersive Background (Enhanced) --- */}
        {item.coverUrl && (
          <div style={{
            position: 'absolute', inset: -100, zIndex: 0,
            backgroundImage: `url(${item.coverUrl})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            filter: 'blur(100px) saturate(1.4)',
            opacity: 0.5,
            pointerEvents: 'none'
          }} />
        )}
        {/* Theme-aware Gradient anchoring */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'radial-gradient(circle at 30% 40%, transparent 0%, var(--bg-primary) 85%, var(--bg-primary) 100%)',
          pointerEvents: 'none',
          opacity: 0.8
        }} />
        {/* --------------------------- */}

        {/* Header — mirrors Library Page header pattern */}
        <header style={{
          position: 'relative', zIndex: 10,
          width: '100%', maxWidth: 896,
          display: 'flex', alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <button
            onClick={() => {
              if (isEditingThis) cancelEdit();
              setExpandedId(null);
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', display: 'flex', padding: 4,
            }}
            title="Back to library"
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1, marginLeft: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-dim)' }}>{getMediaIcon(item.mediaType, 13)}</span>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>
                {item.mediaType.toUpperCase()}
              </span>
            </div>
          </div>
          {/* Action buttons in header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => startEdit(item)}
              className="icon-btn"
              style={{ width: 32, height: 32, color: 'var(--text-secondary)' }}
              title="Edit Media"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={() => { setExpandedId(null); setDeleteConfirmId(item.id); }}
              className="icon-btn"
              style={{ width: 32, height: 32, color: 'var(--text-secondary)' }}
              title="Delete Media"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </header>

        {/* Main Content Container */}
        <div className="story-scroll" style={{
          position: 'relative', zIndex: 10,
          width: '100%', maxWidth: 896, flex: 1,
          display: 'flex', overflowY: 'auto', overflowX: 'hidden',
          padding: '24px 20px 64px',
        }}>
          {isEditingThis ? (
            <div style={{ display: 'flex', gap: 0, width: '100%' }}>
              {/* LEFT: Live cover preview + upload */}
              <div style={{
                width: 240, flexShrink: 0,
                display: 'flex', flexDirection: 'column', gap: 16,
                marginTop: 40,
              }}>
                {/* Cover preview */}
                <div style={{
                  width: '100%', aspectRatio: '3/4',
                  backgroundColor: 'var(--bg-tertiary)',
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1) inset',
                }}>
                  {formCoverUrl ? (
                    <img src={formCoverUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ color: 'var(--text-dim)', opacity: 0.4 }}>
                      <Image size={32} />
                    </div>
                  )}
                </div>
                {/* Cover URL + Upload */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input type="text" value={formCoverUrl} onChange={e => setFormCoverUrl(e.target.value)} placeholder="Cover image URL..." className="edit-modal-input" style={{ padding: '5px 8px', fontSize: 10 }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={async (e: ChangeEvent<HTMLInputElement>) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!cloudSync.isLoggedIn) {
                          alert('Please connect to cloud sync first to upload images.');
                          return;
                        }
                        try {
                          setIsUploading(true);
                          const url = await cloudSync.uploadImage(file);
                          setFormCoverUrl(url);
                        } catch (err) {
                          alert(`Upload failed: ${(err as Error).message}`);
                        } finally {
                          setIsUploading(false);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }
                      }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="btn-action btn-action-secondary"
                      style={{ flex: 1, fontSize: 10, padding: '5px 8px', justifyContent: 'center' }}
                      title={cloudSync.isLoggedIn ? 'Upload cover image' : 'Connect cloud sync to upload'}
                    >
                      <Upload size={11} />
                      {isUploading ? '...' : 'UPLOAD'}
                    </button>
                    {formCoverUrl && (
                      <button
                        onClick={() => setFormCoverUrl('')}
                        className="btn-action btn-action-danger"
                        style={{ fontSize: 10, padding: '5px 8px' }}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT: Form fields */}
              <div style={{ flex: 1, paddingLeft: 40, display: 'flex', flexDirection: 'column' }}>
                {/* Title — uses Limelight font for preview */}
                <div style={{ marginBottom: 24 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>TITLE</span>
                  <input
                    type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)}
                    placeholder="Title..."
                    className="edit-modal-input"
                    style={{
                      padding: '10px 12px', fontSize: 20,
                      fontFamily: '"Limelight", "Times New Roman", serif',
                      fontWeight: 400,
                    }}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); }}
                  />
                </div>

                {/* Structured fields — matches metadata table style */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 0,
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-secondary)',
                  marginBottom: 20,
                }}>
                  {/* Type */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>TYPE</span>
                    <select value={formType} onChange={e => { setFormType(e.target.value as MediaType); setFormMetadata({}); }} className="edit-modal-input" style={{ padding: '3px 8px', fontSize: 11, width: 'auto', textAlign: 'right' }}>
                      {MEDIA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  {/* Status */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>STATUS</span>
                    <select value={formStatus} onChange={e => setFormStatus(e.target.value as MediaStatus | '')} className="edit-modal-input" style={{ padding: '3px 8px', fontSize: 11, width: 'auto', textAlign: 'right' }}>
                      <option value="">No status</option>
                      {MEDIA_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {/* Date Finished */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>FINISHED</span>
                    <input type="date" value={formDateFinished} onChange={e => setFormDateFinished(e.target.value)} className="edit-modal-input" style={{ padding: '3px 8px', fontSize: 11, width: 'auto', textAlign: 'right' }} />
                  </div>
                  {/* Rating */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>RATING</span>
                    <RatingInput value={formRating} onChange={setFormRating} />
                  </div>
                  {/* Per-type metadata fields */}
                  {getMetadataFields(formType).map(field => (
                    <div key={field.key} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}>
                      <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>{field.label.toUpperCase()}</span>
                      <input
                        type={field.inputType}
                        value={(formMetadata[field.key] as string | number) ?? ''}
                        onChange={e => updateMetaField(field.key, field.inputType === 'number' ? (e.target.value ? Number(e.target.value) : '') as unknown as number : e.target.value)}
                        className="edit-modal-input"
                        style={{ padding: '3px 8px', fontSize: 11, width: '55%', textAlign: 'right' }}
                        placeholder={field.label}
                      />
                    </div>
                  ))}
                  {/* Notion URL */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px',
                  }}>
                    <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>NOTION</span>
                    <input type="text" value={formNotionUrl} onChange={e => setFormNotionUrl(e.target.value)} placeholder="URL (optional)" className="edit-modal-input" style={{ padding: '3px 8px', fontSize: 11, width: '55%', textAlign: 'right' }} />
                  </div>
                </div>

                {/* Notes section */}
                <div style={{ flex: 1, marginBottom: 20 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 8,
                    fontSize: 10, fontWeight: 600,
                    color: 'var(--text-dim)', letterSpacing: '0.05em',
                  }}>
                    <span>NOTES</span>
                    <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-subtle)' }} />
                  </div>
                  <textarea
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="Notes, thoughts, review..."
                    className="edit-modal-input"
                    style={{ padding: '10px 12px', fontSize: 12, minHeight: 120, resize: 'vertical', fontFamily: 'var(--font-mono)', lineHeight: 1.7 }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={() => cancelEdit()} className="btn-action btn-action-secondary" style={{ padding: '6px 14px' }}>CANCEL</button>
                  <button onClick={() => saveEdit()} disabled={!formTitle.trim()} className="btn-action btn-action-primary" style={{ padding: '6px 14px' }}>SAVE CHANGES</button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 0, width: '100%' }}>
              {/* LEFT: Cover & Specs */}
              <div style={{
                width: 240, flexShrink: 0,
                display: 'flex', flexDirection: 'column', gap: 20,
                marginTop: 40// Pushes the cover down slightly to align with the cap height of the 42px Limelight title
              }}>
                {/* Cover Image — preserved from original design */}
                <div style={{
                  width: '100%', aspectRatio: '3/4',
                  backgroundColor: 'var(--bg-tertiary)',
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                  boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1) inset',
                }}>
                  {item.coverUrl ? (
                    <img src={item.coverUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ color: 'var(--text-dim)', opacity: 0.4 }}>
                      <Image size={32} />
                    </div>
                  )}
                </div>

                {/* Metadata — compact list, mirrors card body style */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 0,
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-secondary)',
                }}>
                  {/* Rating row */}
                  {item.rating && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}>
                      <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>RATING</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Star size={11} fill="var(--accent)" stroke="var(--accent)" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>{item.rating}</span>
                      </div>
                    </div>
                  )}
                  {/* Status row */}
                  {item.status && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}>
                      <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>STATUS</span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.03em',
                        padding: '1px 6px',
                        backgroundColor: getStatusColor(item.status),
                        color: '#fff',
                      }}>
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                  )}
                  {/* Meta fields */}
                  {metaFields.map(field => {
                    const val = meta[field.key];
                    if (val === undefined || val === '' || val === 0) return null;
                    return (
                      <div key={field.key} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}>
                        <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>{field.label.toUpperCase()}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>{String(val)}</span>
                      </div>
                    );
                  })}
                  {item.dateFinished && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}>
                      <span style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>FINISHED</span>
                      <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>{item.dateFinished}</span>
                    </div>
                  )}
                  {/* Notion link row */}
                  {item.notionUrl && (
                    <a href={item.notionUrl} target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 12px',
                        fontSize: 9, color: 'var(--accent)', letterSpacing: '0.05em',
                        textDecoration: 'none',
                        transition: 'background 100ms',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <ExternalLink size={10} />
                      OPEN IN NOTION
                    </a>
                  )}
                </div>
              </div>

              {/* RIGHT: Title + Notes */}
              <div style={{ flex: 1, paddingLeft: 40, display: 'flex', flexDirection: 'column' }}>
                {/* Title */}
                <div style={{ marginBottom: 32 }}>
                  <h1 style={{
                    fontFamily: '"Limelight", "Times New Roman", serif',
                    fontSize: 42, fontWeight: 400, margin: 0, lineHeight: 1.2,
                    letterSpacing: '0.02em',
                    color: 'var(--text-primary)',
                  }}>
                    {item.title}
                  </h1>
                </div>

                {/* Notes section */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 16,
                    fontSize: 10, fontWeight: 600,
                    color: 'var(--text-dim)', letterSpacing: '0.05em',
                  }}>
                    <span>NOTES</span>
                    <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-subtle)' }} />
                  </div>
                  <div style={{
                    fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap', fontWeight: 400,
                  }}>
                    {item.notes ? (
                      item.notes
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                        No notes yet.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-mono)',
      maxWidth: 896,
      margin: '0 auto',
      cursor: 'default',
      userSelect: 'none',
    }}>
      {/* Header — minimal, matches detail view */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', display: 'flex', padding: 4,
          }}
          title="Back to timeline"
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, marginLeft: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{tokens.panelTitlePrefix}</span>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>LIBRARY</span>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>· {mediaItems.length}</span>
          </div>
        </div>
        {/* Inline search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
          <Search size={13} style={{ color: 'var(--text-dim)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            style={{
              width: 120, padding: '4px 0', fontSize: 11,
              fontFamily: 'var(--font-mono)',
              backgroundColor: 'transparent', color: 'var(--text-primary)',
              border: 'none', outline: 'none',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-dim)', padding: 0, display: 'flex',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
        <button
          onClick={startCreate}
          className="icon-btn"
          style={{ width: 32, height: 32 }}
          title="Add media"
        >
          <Plus size={16} />
        </button>
      </header>

      {/* Create form */}
      {isCreating && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.05em' }}>NEW MEDIA</span>
            <button onClick={() => setIsCreating(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, display: 'flex' }}>
              <X size={14} />
            </button>
          </div>
          {renderForm(handleCreate, () => setIsCreating(false), 'CREATE')}
        </div>
      )}

      {/* Content: grouped by type */}
      <div style={{ padding: '20px 20px 40px' }}>
        {Object.keys(grouped).length === 0 && (
          <div style={{
            padding: '48px 16px', textAlign: 'center',
            color: 'var(--text-dim)', fontSize: 11,
          }}>
            {mediaItems.length === 0
              ? 'No media items yet.'
              : 'No matches found.'}
          </div>
        )}

        {Object.entries(grouped).map(([type, items]) => (
          <div key={type} style={{ marginBottom: 32 }}>
            {/* Section header — label + rule */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 14, fontSize: 10, fontWeight: 600,
              color: 'var(--text-dim)', letterSpacing: '0.05em',
            }}>
              {getMediaIcon(type, 12)}
              <span>{getMediaLabel(type)}</span>
              <span style={{ fontWeight: 400 }}>· {items.length}</span>
              <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-subtle)' }} />
            </div>

            {/* Cards grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 12,
            }}>
              {items.map(item => (
                <React.Fragment key={item.id}>
                  <div style={(editingId === item.id && expandedId !== item.id) ? { gridColumn: '1 / -1' } : undefined}>
                    {(editingId === item.id && expandedId !== item.id) ? (
                      renderForm(saveEdit, cancelEdit, 'SAVE')
                    ) : (
                      <div
                        style={{
                          backgroundColor: deleteConfirmId === item.id ? 'rgba(239,68,68,0.08)' : 'transparent',
                          border: '1px solid var(--border-subtle)',
                          overflow: 'hidden',
                          transition: 'border-color 150ms ease',
                          cursor: 'pointer',
                        }}
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text-dim)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                      >
                        {/* Cover image — clean */}
                        <div style={{
                          width: '100%', aspectRatio: '3 / 4',
                          backgroundColor: 'var(--bg-tertiary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden',
                        }}>
                          {item.coverUrl ? (
                            <img src={item.coverUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ color: 'var(--text-dim)', opacity: 0.3 }}>
                              <Image size={20} />
                            </div>
                          )}
                        </div>

                        {/* Card body */}
                        <div style={{ padding: '8px 10px' }}>
                          <div style={{
                            fontSize: 11, fontWeight: 500,
                            color: 'var(--text-primary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            marginBottom: 3,
                          }}>
                            {item.title}
                          </div>
                          <div style={{
                            fontSize: 9, color: 'var(--text-dim)',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            {item.metadata?.director && <span>{item.metadata.director}</span>}
                            {item.metadata?.author && <span>{item.metadata.author}</span>}
                            {item.metadata?.developer && <span>{item.metadata.developer}</span>}
                            {item.metadata?.host && <span>{item.metadata.host}</span>}
                            {item.metadata?.year && <span>· {item.metadata.year}</span>}
                            {item.rating && (
                              <span style={{ marginLeft: 'auto', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Star size={8} fill="var(--accent)" stroke="var(--accent)" />
                                {item.rating}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            padding: 24, maxWidth: 360, width: '100%',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 16, color: 'var(--text-primary)' }}>
              DELETE MEDIA
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              Are you sure you want to delete this item? This cannot be undone.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setDeleteConfirmId(null)} className="btn-action btn-action-secondary" style={{ padding: '6px 14px' }}>CANCEL</button>
              <button onClick={() => handleDelete(deleteConfirmId)} className="btn-action btn-action-danger" style={{ padding: '6px 14px' }}>DELETE</button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Expanded detail modal */}
      {expandedId && renderDetail(mediaItems.find(i => i.id === expandedId)!)}
    </div>
  );
}
