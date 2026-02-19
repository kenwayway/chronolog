import { useMemo, useState, useRef, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Book, Film, Gamepad2, Tv, Clapperboard, Mic, ExternalLink, Pencil, Trash2, Check, X, Plus, Search, Image, Upload } from 'lucide-react';
import { useSessionContext } from '../contexts/SessionContext';
import { useCloudSyncContext } from '../contexts/CloudSyncContext';
import { useTheme } from '../hooks/useTheme';
import type { MediaItem, MediaType } from '../types';
import { generateId } from '../utils/formatters';

const MEDIA_TYPES: MediaType[] = ['Book', 'Movie', 'Game', 'TV', 'Anime', 'Podcast'];

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

    // Edit/create form state
    const [formTitle, setFormTitle] = useState('');
    const [formType, setFormType] = useState<MediaType>('Movie');
    const [formNotionUrl, setFormNotionUrl] = useState('');
    const [formCoverUrl, setFormCoverUrl] = useState('');
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

    const startEdit = (item: MediaItem) => {
        setEditingId(item.id);
        setFormTitle(item.title);
        setFormType(item.mediaType);
        setFormNotionUrl(item.notionUrl || '');
        setFormCoverUrl(item.coverUrl || '');
        setIsCreating(false);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormTitle('');
        setFormType('Movie');
        setFormNotionUrl('');
        setFormCoverUrl('');
    };

    const saveEdit = () => {
        if (!editingId || !formTitle.trim()) return;
        updateMediaItem(editingId, {
            title: formTitle.trim(),
            mediaType: formType,
            notionUrl: formNotionUrl.trim() || undefined,
            coverUrl: formCoverUrl.trim() || undefined,
        });
        cancelEdit();
    };

    const startCreate = () => {
        setIsCreating(true);
        setEditingId(null);
        setFormTitle('');
        setFormType('Movie');
        setFormNotionUrl('');
        setFormCoverUrl('');
    };

    const handleCreate = () => {
        if (!formTitle.trim()) return;
        addMediaItem({
            id: generateId(),
            title: formTitle.trim(),
            mediaType: formType,
            notionUrl: formNotionUrl.trim() || undefined,
            coverUrl: formCoverUrl.trim() || undefined,
            createdAt: Date.now(),
        });
        setIsCreating(false);
        setFormTitle('');
        setFormType('Movie');
        setFormNotionUrl('');
        setFormCoverUrl('');
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

    // Inline edit/create form component
    const renderForm = (onSave: () => void, onCancel: () => void, saveLabel: string) => (
        <div style={{
            padding: 12,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--accent)',
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                    <select value={formType} onChange={e => setFormType(e.target.value as MediaType)} className="edit-modal-input" style={{ padding: '5px 8px', fontSize: 11, width: 'auto' }}>
                        {MEDIA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Title..." className="edit-modal-input" style={{ flex: 1, padding: '5px 8px', fontSize: 11 }} autoFocus onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="text" value={formCoverUrl} onChange={e => setFormCoverUrl(e.target.value)} placeholder="Cover image URL..." className="edit-modal-input" style={{ flex: 1, padding: '5px 8px', fontSize: 11 }} onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }} />
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
                <input type="text" value={formNotionUrl} onChange={e => setFormNotionUrl(e.target.value)} placeholder="Notion URL (optional)..." className="edit-modal-input" style={{ padding: '5px 8px', fontSize: 11 }} onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 2 }}>
                    <button onClick={onCancel} className="btn-action btn-action-secondary" style={{ fontSize: 10, padding: '3px 8px' }}>CANCEL</button>
                    <button onClick={onSave} disabled={!formTitle.trim()} className="btn-action btn-action-primary" style={{ fontSize: 10, padding: '3px 8px' }}>{saveLabel}</button>
                </div>
            </div>
        </div>
    );

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            maxWidth: 896,
            margin: '0 auto',
        }}>
            {/* Header */}
            <header style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-secondary)',
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
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{tokens.panelTitlePrefix}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>LIBRARY</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                        {mediaItems.length} items
                    </span>
                </div>
                <button
                    onClick={startCreate}
                    className="btn-action btn-action-primary"
                    style={{ fontSize: 10, padding: '4px 10px' }}
                >
                    <Plus size={12} />
                    ADD
                </button>
            </header>

            {/* Search bar */}
            <div style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border-subtle)',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '0 10px',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                }}>
                    <Search size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search library..."
                        style={{
                            flex: 1, padding: '8px 0', fontSize: 12,
                            fontFamily: 'var(--font-mono)',
                            backgroundColor: 'transparent', color: 'var(--text-primary)',
                            border: 'none', outline: 'none',
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
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Type stats bar */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8,
                padding: '12px 20px',
                borderBottom: '1px solid var(--border-subtle)',
            }}>
                {MEDIA_TYPES.map(type => (
                    <div key={type} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 10, color: typeCounts[type] > 0 ? 'var(--text-secondary)' : 'var(--text-dim)',
                    }}>
                        {getMediaIcon(type, 12)}
                        <span>{typeCounts[type] || 0}</span>
                    </div>
                ))}
            </div>

            {/* Create form */}
            {isCreating && (
                <div style={{ margin: '16px 20px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.05em' }}>NEW MEDIA</span>
                        <button onClick={() => setIsCreating(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, display: 'flex' }}>
                            <X size={14} />
                        </button>
                    </div>
                    {renderForm(handleCreate, () => setIsCreating(false), 'CREATE')}
                </div>
            )}

            {/* Content: grouped by type, card layout */}
            <div style={{ padding: '16px 20px 40px' }}>
                {Object.keys(grouped).length === 0 && (
                    <div style={{
                        padding: '40px 16px', textAlign: 'center',
                        color: 'var(--text-dim)', fontSize: 12,
                    }}>
                        {mediaItems.length === 0
                            ? 'No media items yet. Click ADD to create your first one.'
                            : 'No matches found.'}
                    </div>
                )}

                {Object.entries(grouped).map(([type, items]) => (
                    <div key={type} style={{ marginBottom: 28 }}>
                        {/* Section header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            marginBottom: 12, fontSize: 10, fontWeight: 600,
                            color: 'var(--text-dim)', letterSpacing: '0.05em',
                        }}>
                            {getMediaIcon(type, 13)}
                            <span>{getMediaLabel(type)}</span>
                            <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>· {items.length}</span>
                            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border-subtle)' }} />
                        </div>

                        {/* Cards grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                            gap: 10,
                        }}>
                            {items.map(item => (
                                <div key={item.id} style={editingId === item.id ? { gridColumn: '1 / -1' } : undefined}>
                                    {editingId === item.id ? (
                                        renderForm(saveEdit, cancelEdit, 'SAVE')
                                    ) : (
                                        <div
                                            style={{
                                                backgroundColor: deleteConfirmId === item.id
                                                    ? 'rgba(239,68,68,0.08)'
                                                    : 'var(--bg-secondary)',
                                                border: '1px solid var(--border-subtle)',
                                                overflow: 'hidden',
                                                transition: 'border-color 150ms ease',
                                                cursor: 'default',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--text-dim)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                            }}
                                        >
                                            {/* Cover image */}
                                            <div style={{
                                                width: '100%',
                                                aspectRatio: '3 / 4',
                                                backgroundColor: 'var(--bg-tertiary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden',
                                                borderBottom: '1px solid var(--border-subtle)',
                                            }}>
                                                {item.coverUrl ? (
                                                    <img
                                                        src={item.coverUrl}
                                                        alt={item.title}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover',
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: 4,
                                                        color: 'var(--text-dim)',
                                                        opacity: 0.4,
                                                    }}>
                                                        <Image size={24} />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Card body */}
                                            <div style={{ padding: '8px 10px' }}>
                                                <div style={{
                                                    fontSize: 11,
                                                    fontWeight: 500,
                                                    color: 'var(--text-primary)',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    marginBottom: 4,
                                                }}>
                                                    {item.title}
                                                </div>
                                                <div style={{
                                                    fontSize: 9,
                                                    color: 'var(--text-dim)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                }}>
                                                    {getMediaIcon(item.mediaType, 10)}
                                                    <span>{item.mediaType}</span>
                                                </div>
                                            </div>

                                            {/* Card actions */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '4px 6px',
                                                borderTop: '1px solid var(--border-subtle)',
                                            }}>
                                                {deleteConfirmId === item.id ? (
                                                    <div style={{ display: 'flex', gap: 4, width: '100%', justifyContent: 'center' }}>
                                                        <button onClick={() => setDeleteConfirmId(null)} className="btn-action btn-action-secondary" style={{ fontSize: 9, padding: '2px 6px' }}>NO</button>
                                                        <button onClick={() => handleDelete(item.id)} className="btn-action btn-action-danger" style={{ fontSize: 9, padding: '2px 6px' }}>DELETE</button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div style={{ display: 'flex', gap: 2 }}>
                                                            {item.notionUrl && (
                                                                <a href={item.notionUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="icon-btn" style={{ width: 22, height: 22 }} title="Notion">
                                                                    <ExternalLink size={11} />
                                                                </a>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 2 }}>
                                                            <button onClick={() => startEdit(item)} className="icon-btn" style={{ width: 22, height: 22 }} title="Edit"><Pencil size={11} /></button>
                                                            <button onClick={() => setDeleteConfirmId(item.id)} className="icon-btn" style={{ width: 22, height: 22 }} title="Delete"><Trash2 size={11} /></button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
