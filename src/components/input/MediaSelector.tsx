import { useState, useRef, useEffect } from 'react';
import { Book, Film, Gamepad2, Tv, Clapperboard, Mic, Plus, X, ExternalLink } from 'lucide-react';
import type { MediaItem, MediaType } from '../../types';
import { generateId } from '../../utils/formatters';

interface MediaSelectorProps {
    mediaItems: MediaItem[];
    selectedMediaId: string | undefined;
    onChange: (mediaId: string | undefined) => void;
    onAddMediaItem: (mediaItem: MediaItem) => void;
}

const MEDIA_TYPES: MediaType[] = ['Book', 'Movie', 'Game', 'TV', 'Anime', 'Podcast'];

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
}: MediaSelectorProps) {
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newType, setNewType] = useState<MediaType>('Movie');
    const [newNotionUrl, setNewNotionUrl] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedMedia = mediaItems.find(m => m.id === selectedMediaId);

    // Filter media items by search query
    const filteredItems = mediaItems.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    if (isCreating) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 12,
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-light)',
                borderRadius: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>NEW MEDIA</span>
                    <button
                        onClick={() => setIsCreating(false)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-dim)',
                            padding: 2,
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as MediaType)}
                        style={{
                            padding: '6px 8px',
                            fontSize: 12,
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
                            padding: '6px 10px',
                            fontSize: 12,
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
                        padding: '6px 10px',
                        fontSize: 12,
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
                        padding: '6px 12px',
                        fontSize: 11,
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
                    gap: 8,
                    padding: '6px 10px',
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
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', flex: 1 }}>
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
                    </>
                ) : (
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                        Select media...
                    </span>
                )}
            </div>

            {/* Dropdown */}
            {isDropdownOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 0,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    zIndex: 1000,
                    maxHeight: 300,
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
                            padding: '8px 10px',
                            fontSize: 12,
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
                                    gap: 8,
                                    padding: '8px 10px',
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
                                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', flex: 1 }}>
                                    {item.title}
                                </span>
                                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                                    {item.mediaType}
                                </span>
                            </div>
                        ))}

                        {filteredItems.length === 0 && (
                            <div style={{ padding: '12px 10px', fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
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
                            gap: 6,
                            padding: '10px',
                            fontSize: 11,
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
                </div>
            )}
        </div>
    );
}
