import { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
    tags: string[];
    setTags: (tags: string[]) => void;
}

/**
 * Inline tag input with add/remove support
 */
export function TagInput({ tags, setTags }: TagInputProps) {
    const [tagInput, setTagInput] = useState('');

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
        <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', userSelect: 'none' }}>
                TAGS
            </span>
            <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="add..."
                style={{
                    width: 60,
                    height: 22,
                    padding: '0 6px',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 0,
                    outline: 'none',
                }}
            />
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
    );
}
