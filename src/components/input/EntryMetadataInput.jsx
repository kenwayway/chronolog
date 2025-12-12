import { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { Dropdown } from '../common/Dropdown';
import { CATEGORIES, BUILTIN_CONTENT_TYPES } from '../../utils/constants';

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
    onToggle,
}) {
    const [tagInput, setTagInput] = useState('');

    const handleAddTag = () => {
        const tag = tagInput.trim().toLowerCase().replace(/^#/, '');
        if (tag && !tags.includes(tag)) {
            setTags([...tags, tag]);
            setTagInput('');
        }
    };

    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleAddTag();
        }
    };

    const handleRemoveTag = (tagToRemove) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    if (!isExpanded) return null;

    return (
        <div
            className="entry-metadata-input"
            style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
            }}
        >
            {/* Row 1: Category & Content Type */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {/* Category */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>
                        CATEGORY
                    </span>
                    <Dropdown
                        value={category}
                        onChange={(val) => setCategory(val || null)}
                        placeholder="Auto"
                        options={[
                            { value: '', label: 'Auto (AI)' },
                            ...CATEGORIES.map(cat => ({
                                value: cat.id,
                                label: cat.label,
                                color: cat.color,
                            })),
                        ]}
                    />
                </div>

                {/* Content Type */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>
                        TYPE
                    </span>
                    <select
                        value={contentType || ''}
                        onChange={(e) => setContentType(e.target.value || null)}
                        className="edit-modal-input"
                        style={{ width: 100, fontSize: 11 }}
                    >
                        <option value="">Auto (AI)</option>
                        <option value="note">Note</option>
                        <option value="task">Task</option>
                        <option value="expense">Expense</option>
                        <option value="bookmark">Bookmark</option>
                        <option value="mood">Mood</option>
                    </select>
                </div>
            </div>

            {/* Row 2: Tags */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>
                        TAGS
                    </span>
                    <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        placeholder="Add tag..."
                        className="edit-modal-input"
                        style={{ width: 120, fontSize: 11 }}
                    />
                    <button
                        onClick={handleAddTag}
                        disabled={!tagInput.trim()}
                        style={{
                            padding: '2px 8px',
                            fontSize: 10,
                            backgroundColor: tagInput.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
                            color: tagInput.trim() ? 'white' : 'var(--text-dim)',
                            border: 'none',
                            borderRadius: 3,
                            cursor: tagInput.trim() ? 'pointer' : 'default',
                        }}
                    >
                        +
                    </button>
                </div>

                {/* Tag chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {tags.map(tag => (
                        <span
                            key={tag}
                            style={{
                                fontSize: 10,
                                padding: '2px 6px',
                                borderRadius: 3,
                                backgroundColor: 'var(--accent-subtle)',
                                color: 'var(--accent)',
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
                    {tags.length === 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                            No tags
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
