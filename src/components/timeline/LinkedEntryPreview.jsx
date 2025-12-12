import { memo } from 'react';
import { formatDate, formatTime } from '../../utils/formatters';
import { getPreview } from '../../utils/contentParser';

/**
 * Preview of a linked entry with navigation support
 */
export const LinkedEntryPreview = memo(function LinkedEntryPreview({
    linkedEntry,
    direction,
    onNavigateToEntry,
}) {
    const handleClick = () => {
        // Try to find the element on current page first
        const entryElement = document.querySelector(`[data-entry-id="${linkedEntry.id}"]`);
        if (entryElement) {
            entryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            entryElement.style.backgroundColor = 'var(--accent-subtle)';
            setTimeout(() => {
                entryElement.style.backgroundColor = '';
            }, 1500);
        } else {
            // Entry not on current page, navigate to its date
            onNavigateToEntry?.(linkedEntry);
        }
    };

    return (
        <button
            className="linked-entry-preview"
            onClick={handleClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                marginLeft: 86,
                marginBottom: direction === 'before' ? 4 : 0,
                marginTop: direction === 'after' ? 4 : 0,
                fontSize: 11,
                color: 'var(--text-secondary)',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: 4,
                cursor: 'pointer',
                width: 'calc(100% - 86px)',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                fontFamily: 'var(--font-mono)',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.color = 'var(--text-secondary)';
            }}
        >
            <span style={{
                color: 'var(--accent)',
                fontWeight: 600,
                fontSize: 12,
                lineHeight: 1,
                width: 14,
                display: 'inline-block',
                textAlign: 'center'
            }}>
                {direction === 'before' ? '↱' : '↳'}
            </span>

            <span style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            }}>
                {getPreview(linkedEntry.content)}
            </span>
        </button>
    );
});
