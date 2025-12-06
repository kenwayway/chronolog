import { useEffect, useRef } from 'react'
import { ENTRY_TYPES } from '../utils/constants'

export function ContextMenu({ isOpen, position, entry, onClose, onEdit, onDelete, onCopy, onToggleTodo }) {
    const menuRef = useRef(null)

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            document.addEventListener('touchstart', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('touchstart', handleClickOutside)
        }
    }, [isOpen, onClose])

    if (!isOpen || !entry) return null

    const handleEdit = () => { onEdit(entry); onClose() }
    const handleDelete = () => { onDelete(entry); onClose() }
    const handleCopy = () => { onCopy(entry); onClose() }
    const handleToggleTodo = () => { onToggleTodo(entry.id); onClose() }

    const isNote = entry.type === ENTRY_TYPES.NOTE

    const menuItemStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        width: '100%',
        padding: '0.375rem 0.75rem',
        fontSize: '0.75rem',
        color: 'var(--text-primary)',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 150ms ease'
    }

    return (
        <div
            ref={menuRef}
            className="fixed font-mono animate-slide-in"
            style={{
                left: position.x,
                top: position.y,
                minWidth: 160,
                padding: 4,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: 8,
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                zIndex: 500
            }}
        >
            <div className="flex items-center gap-2 px-2 py-1 border-b mb-1" style={{ fontSize: 10, color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                <span className="uppercase tracking-wider font-bold">ACTION</span>
            </div>

            {isNote && (
                <button
                    style={menuItemStyle}
                    onMouseEnter={e => { e.target.style.backgroundColor = 'var(--bg-tertiary)'; e.target.style.color = 'var(--accent)' }}
                    onMouseLeave={e => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = 'var(--text-primary)' }}
                    onClick={handleToggleTodo}
                >
                    <span style={{ opacity: 0.5 }}>[T]</span>
                    {entry.isTodo ? 'UNMARK TODO' : 'MARK AS TODO'}
                </button>
            )}

            <button
                style={menuItemStyle}
                onMouseEnter={e => { e.target.style.backgroundColor = 'var(--bg-tertiary)'; e.target.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = 'var(--text-primary)' }}
                onClick={handleEdit}
            >
                <span style={{ opacity: 0.5 }}>[E]</span>
                EDIT
            </button>

            <button
                style={menuItemStyle}
                onMouseEnter={e => { e.target.style.backgroundColor = 'var(--bg-tertiary)'; e.target.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = 'var(--text-primary)' }}
                onClick={handleCopy}
            >
                <span style={{ opacity: 0.5 }}>[Y]</span>
                COPY
            </button>

            <div style={{ height: 1, margin: '4px', backgroundColor: 'var(--border-subtle)' }} />

            <button
                style={{ ...menuItemStyle, color: 'var(--error)' }}
                onMouseEnter={e => e.target.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
                onClick={handleDelete}
            >
                <span style={{ opacity: 0.5 }}>[D]</span>
                DELETE
            </button>
        </div>
    )
}
