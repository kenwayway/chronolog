import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Dropdown } from '../common/Dropdown';
import { CATEGORIES, BUILTIN_CONTENT_TYPES } from '../../utils/constants';
import type { CategoryId } from '../../types';

// Generate content type options from BUILTIN_CONTENT_TYPES
const CONTENT_TYPE_OPTIONS = [
    { value: '', label: 'Auto' },
    ...BUILTIN_CONTENT_TYPES.map(ct => ({ value: ct.id, label: ct.name }))
];

interface EntryMetadataInputProps {
    category: CategoryId | null;
    setCategory: (category: CategoryId | null) => void;
    contentType: string | null;
    setContentType: (contentType: string | null) => void;
    tags: string[];
    setTags: (tags: string[]) => void;
    isExpanded: boolean;
}

/**
 * Shared component for entry metadata input
 * Used in FocusMode and can be reused in EditModal
 */
export function EntryMetadataInput({
    category,
    setCategory,
    contentType,
    setContentType,
    tags,
    setTags,
    isExpanded,
}: EntryMetadataInputProps) {
    const [tagInput, setTagInput] = useState('');
    const [height, setHeight] = useState(0);
    const contentRef = useRef<HTMLDivElement>(null);

    // Measure content height for smooth animation
    useEffect(() => {
        if (contentRef.current) {
            setHeight(isExpanded ? contentRef.current.scrollHeight : 0);
        }
    }, [isExpanded, tags.length]);

    const handleAddTag = () => {
        const tag = tagInput.trim().toLowerCase().replace(/^#/, '');
        if (tag && !tags.includes(tag)) {
            setTags([...tags, tag]);
            setTagInput('');
        }
    };

    const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleAddTag();
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    return (
        <div
            className="entry-metadata-input"
            style={{
                overflow: 'hidden',
                height: height,
                transition: 'height 0.2s ease-out',
                borderTop: isExpanded ? '1px solid var(--border-subtle)' : 'none',
            }}
        >
            <div
                ref={contentRef}
                style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--bg-secondary)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 12,
                }}
            >
                {/* Category */}
                <div className="flex items-center gap-2">
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', userSelect: 'none' }}>
                        CATEGORY
                    </span>
                    <Dropdown
                        value={category}
                        onChange={(val) => setCategory((val || null) as CategoryId | null)}
                        placeholder="Auto"
                        options={[
                            { value: '', label: 'Auto' },
                            ...CATEGORIES.map(cat => ({
                                value: cat.id,
                                label: cat.label,
                                color: cat.color,
                            })),
                        ]}
                    />
                </div>

                {/* Content Type */}
                <div className="flex items-center gap-2">
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', userSelect: 'none' }}>
                        TYPE
                    </span>
                    <Dropdown
                        value={contentType}
                        onChange={(val) => setContentType(val || null)}
                        placeholder="Auto"
                        options={CONTENT_TYPE_OPTIONS}
                    />
                </div>

                {/* Tags inline */}
                <div className="flex items-center gap-2" style={{ flex: 1, minWidth: 150 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', userSelect: 'none' }}>
                        TAGS
                    </span>
                    <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        placeholder="Add tag..."
                        className="edit-modal-input"
                        style={{ width: 100, fontSize: 11 }}
                    />
                    <button
                        onClick={handleAddTag}
                        className="btn-action btn-action-primary"
                    >
                        ADD
                    </button>
                    {tags.map(tag => (
                        <span
                            key={tag}
                            style={{
                                fontSize: 10,
                                padding: '2px 6px',
                                backgroundColor: 'var(--bg-tertiary)',
                                color: 'var(--text-secondary)',
                                fontFamily: 'var(--font-mono)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            #{tag}
                            <X
                                size={10}
                                style={{ cursor: 'pointer' }}
                                onClick={() => handleRemoveTag(tag)}
                            />
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
