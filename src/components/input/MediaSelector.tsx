import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Book, Film, Gamepad2, Tv, Clapperboard, Mic, Plus, X, ExternalLink, Pencil, Check } from 'lucide-react';
import type { MediaItem, MediaType } from '@/types';
import { generateId } from '@/utils/formatters';

interface MediaSelectorProps {
    mediaItems: MediaItem[];
    selectedMediaId: string | undefined;
    onChange: (mediaId: string | undefined) => void;
    onAddMediaItem: (mediaItem: MediaItem) => void;
    onUpdateMediaItem?: (id: string, updates: Partial<Omit<MediaItem, 'id' | 'createdAt'>>) => void;
}

const MEDIA_TYPES: MediaType[] = ['Book', 'Movie', 'Game', 'TV', 'Anime', 'Podcast'];

const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 300;
const MENU_MIN_HEIGHT = 160;
const MENU_MIN_WIDTH = 220;

interface MenuPosition {
    left: number;
    width: number;
    maxHeight: number;
    top?: number;
    bottom?: number;
}

const getMediaIcon = (mediaType: MediaType, size: number = 14) => {
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

/**
 * MediaSelector - Select from Media Library or create new media item
 */
export function MediaSelector({
    mediaItems,
    selectedMediaId,
    onChange,
    onAddMediaItem,
    onUpdateMediaItem,
}: MediaSelectorProps) {
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newType, setNewType] = useState<MediaType>('Movie');
    const [newNotionUrl, setNewNotionUrl] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editType, setEditType] = useState<MediaType>('Movie');
    const [editNotionUrl, setEditNotionUrl] = useState('');
    const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const selectedMedia = mediaItems.find(m => m.id === selectedMediaId);

    // Filter media items by search query
    const filteredItems = mediaItems.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // The metadata row clips its children (grid expand animation), so the menu is
    // rendered in a portal and positioned against the trigger instead.
    const updateMenuPosition = useCallback(() => {
        const trigger = dropdownRef.current;
        if (!trigger) return;

        const rect = trigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
        const spaceAbove = rect.top - MENU_GAP;
        // The input panel lives at the bottom of the viewport, so flip up when
        // there is not enough room underneath.
        const openUp = spaceBelow < Math.min(MENU_MAX_HEIGHT, spaceAbove);
        const width = Math.max(rect.width, MENU_MIN_WIDTH);

        setMenuPosition({
            left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
            width,
            maxHeight: Math.max(MENU_MIN_HEIGHT, Math.min(MENU_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow)),
            ...(openUp
                ? { bottom: window.innerHeight - rect.top + MENU_GAP }
                : { top: rect.bottom + MENU_GAP }),
        });
    }, []);

    useLayoutEffect(() => {
        if (!isDropdownOpen) return;
        updateMenuPosition();
        window.addEventListener('resize', updateMenuPosition);
        window.addEventListener('scroll', updateMenuPosition, true);
        return () => {
            window.removeEventListener('resize', updateMenuPosition);
            window.removeEventListener('scroll', updateMenuPosition, true);
        };
    }, [isDropdownOpen, updateMenuPosition]);

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!isDropdownOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (dropdownRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setIsDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDropdownOpen]);

    const handleCreate = () => {
        if (!newTitle.trim()) return;

        const newItem: MediaItem = {
            id: generateId(),
            title: newTitle.trim(),
            mediaType: newType,
            notionUrl: newNotionUrl.trim() || undefined,
            createdAt: Date.now(),
        };

        onAddMediaItem(newItem);
        onChange(newItem.id);
        setIsCreating(false);
        setNewTitle('');
        setNewType('Movie');
        setNewNotionUrl('');
    };

    const handleSelect = (mediaId: string) => {
        onChange(mediaId);
        setIsDropdownOpen(false);
        setSearchQuery('');
    };

    const startEdit = () => {
        if (!selectedMedia) return;
        setEditTitle(selectedMedia.title);
        setEditType(selectedMedia.mediaType);
        setEditNotionUrl(selectedMedia.notionUrl || '');
        setIsEditing(true);
    };

    const cancelEdit = () => {
        setIsEditing(false);
    };

    const saveEdit = () => {
        if (!selectedMedia || !editTitle.trim() || !onUpdateMediaItem) return;
        onUpdateMediaItem(selectedMedia.id, {
            title: editTitle.trim(),
            mediaType: editType,
            notionUrl: editNotionUrl.trim() || undefined,
        });
        setIsEditing(false);
    };

    if (isEditing && selectedMedia) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: "var(--space-2)",
                padding: "var(--space-3)",
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--accent)',
                borderRadius: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.05em' }}>EDIT MEDIA</span>
                    <button
                        onClick={cancelEdit}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-dim)', padding: 0, display: 'flex',
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>
                <div style={{ display: 'flex', gap: "var(--space-2)" }}>
                    <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as MediaType)}
                        style={{
                            padding: 'var(--space-1) var(--space-2)', fontSize: "var(--text-xs)", fontFamily: 'var(--font-mono)',
                            backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)',
                            border: '1px solid var(--border-light)', borderRadius: 0, cursor: 'pointer',
                        }}
                    >
                        {MEDIA_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                    <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Title..."
                        autoFocus
                        style={{
                            flex: 1, padding: 'var(--space-1) var(--space-2)', fontSize: "var(--text-xs)", fontFamily: 'var(--font-mono)',
                            backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)',
                            border: '1px solid var(--border-light)', borderRadius: 0,
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                        }}
                    />
                </div>
                <input
                    type="text"
                    value={editNotionUrl}
                    onChange={(e) => setEditNotionUrl(e.target.value)}
                    placeholder="Notion URL (optional)..."
                    style={{
                        padding: 'var(--space-1) var(--space-2)', fontSize: "var(--text-xs)", fontFamily: 'var(--font-mono)',
                        backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)',
                        border: '1px solid var(--border-light)', borderRadius: 0,
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit();
                        if (e.key === 'Escape') cancelEdit();
                    }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: "var(--space-2)" }}>
                    <button
                        onClick={cancelEdit}
                        style={{
                            padding: 'var(--space-1) var(--space-2)', fontSize: "var(--text-xs)", fontWeight: 600, fontFamily: 'var(--font-mono)',
                            backgroundColor: 'transparent', color: 'var(--text-secondary)',
                            border: '1px solid var(--text-dim)', cursor: 'pointer',
                        }}
                    >
                        CANCEL
                    </button>
                    <button
                        onClick={saveEdit}
                        disabled={!editTitle.trim()}
                        style={{
                            padding: 'var(--space-1) var(--space-2)', fontSize: "var(--text-xs)", fontWeight: 600, fontFamily: 'var(--font-mono)',
                            backgroundColor: editTitle.trim() ? 'var(--accent)' : 'var(--bg-secondary)',
                            color: editTitle.trim() ? 'white' : 'var(--text-dim)',
                            border: 'none', cursor: editTitle.trim() ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', gap: "var(--space-1)",
                        }}
                    >
                        <Check size={10} />
                        SAVE
                    </button>
                </div>
            </div>
        );
    }

    if (isCreating) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: "var(--space-2)",
                padding: "var(--space-3)",
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-light)',
                borderRadius: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: 'var(--text-muted)' }}>NEW MEDIA</span>
                    <button
                        onClick={() => setIsCreating(false)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-dim)',
                            padding: "var(--space-05)",
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>

                <div style={{ display: 'flex', gap: "var(--space-2)" }}>
                    <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as MediaType)}
                        style={{
                            padding: 'var(--space-2) var(--space-2)',
                            fontSize: "var(--text-sm)",
                            fontFamily: 'var(--font-mono)',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-light)',
                            borderRadius: 0,
                            cursor: 'pointer',
                        }}
                    >
                        {MEDIA_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                    <input
                        ref={inputRef}
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Title..."
                        autoFocus
                        style={{
                            flex: 1,
                            padding: 'var(--space-2) var(--space-3)',
                            fontSize: "var(--text-sm)",
                            fontFamily: 'var(--font-mono)',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-light)',
                            borderRadius: 0,
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreate();
                            if (e.key === 'Escape') setIsCreating(false);
                        }}
                    />
                </div>

                <input
                    type="text"
                    value={newNotionUrl}
                    onChange={(e) => setNewNotionUrl(e.target.value)}
                    placeholder="Notion URL (optional)..."
                    style={{
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: "var(--text-sm)",
                        fontFamily: 'var(--font-mono)',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 0,
                    }}
                />

                <button
                    onClick={handleCreate}
                    disabled={!newTitle.trim()}
                    style={{
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: "var(--text-xs)",
                        fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                        backgroundColor: newTitle.trim() ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: newTitle.trim() ? 'white' : 'var(--text-dim)',
                        border: 'none',
                        borderRadius: 0,
                        cursor: newTitle.trim() ? 'pointer' : 'default',
                    }}
                >
                    CREATE
                </button>
            </div>
        );
    }

    return (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
            {/* Selected item or placeholder */}
            <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: "var(--space-2)",
                    padding: 'var(--space-2) var(--space-3)',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 0,
                    cursor: 'pointer',
                    minWidth: 180,
                }}
            >
                {selectedMedia ? (
                    <>
                        <span style={{ color: 'var(--text-secondary)', display: 'flex' }}>
                            {getMediaIcon(selectedMedia.mediaType)}
                        </span>
                        <span style={{ fontSize: "var(--text-sm)", fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', flex: 1 }}>
                            {selectedMedia.title}
                        </span>
                        {selectedMedia.notionUrl && (
                            <a
                                href={selectedMedia.notionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ color: 'var(--accent)', display: 'flex' }}
                            >
                                <ExternalLink size={12} />
                            </a>
                        )}
                        {onUpdateMediaItem && (
                            <button
                                onClick={(e) => { e.stopPropagation(); startEdit(); }}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-dim)', padding: "var(--space-05)", display: 'flex',
                                    transition: 'color 150ms',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; }}
                                title="Edit media"
                            >
                                <Pencil size={12} />
                            </button>
                        )}
                    </>
                ) : (
                    <span style={{ fontSize: "var(--text-sm)", fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                        Select media...
                    </span>
                )}
            </div>

            {/* Dropdown - portaled so the input panel cannot clip or cover it */}
            {isDropdownOpen && menuPosition && createPortal(
                <div ref={menuRef} style={{
                    position: 'fixed',
                    top: menuPosition.top,
                    bottom: menuPosition.bottom,
                    left: menuPosition.left,
                    width: menuPosition.width,
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 0,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    zIndex: 9999,
                    maxHeight: menuPosition.maxHeight,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    {/* Search */}
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        autoFocus
                        style={{
                            padding: 'var(--space-2) var(--space-3)',
                            fontSize: "var(--text-sm)",
                            fontFamily: 'var(--font-mono)',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: 'none',
                            borderBottom: '1px solid var(--border-subtle)',
                            outline: 'none',
                        }}
                    />

                    {/* Items */}
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        {filteredItems.map(item => (
                            <div
                                key={item.id}
                                onClick={() => handleSelect(item.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: "var(--space-2)",
                                    padding: 'var(--space-2) var(--space-3)',
                                    cursor: 'pointer',
                                    backgroundColor: item.id === selectedMediaId ? 'var(--accent-subtle)' : 'transparent',
                                }}
                                onMouseEnter={(e) => {
                                    if (item.id !== selectedMediaId) {
                                        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = item.id === selectedMediaId ? 'var(--accent-subtle)' : 'transparent';
                                }}
                            >
                                <span style={{ color: 'var(--text-secondary)', display: 'flex' }}>
                                    {getMediaIcon(item.mediaType)}
                                </span>
                                <span style={{ fontSize: "var(--text-sm)", fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', flex: 1 }}>
                                    {item.title}
                                </span>
                                <span style={{ fontSize: "var(--text-xs)", color: 'var(--text-dim)' }}>
                                    {item.mediaType}
                                </span>
                            </div>
                        ))}

                        {filteredItems.length === 0 && (
                            <div style={{ padding: 'var(--space-3) var(--space-3)', fontSize: "var(--text-xs)", color: 'var(--text-dim)', textAlign: 'center' }}>
                                No media found
                            </div>
                        )}
                    </div>

                    {/* Add new */}
                    <button
                        onClick={() => {
                            setIsDropdownOpen(false);
                            setIsCreating(true);
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: "var(--space-2)",
                            padding: 'var(--space-3)',
                            fontSize: "var(--text-xs)",
                            fontWeight: 600,
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--accent)',
                            backgroundColor: 'var(--bg-secondary)',
                            border: 'none',
                            borderTop: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            flexShrink: 0,
                        }}
                    >
                        <Plus size={14} />
                        ADD NEW MEDIA
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
}
