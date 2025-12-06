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

    const handleEdit = () => {
        onEdit(entry)
        onClose()
    }

    const handleDelete = () => {
        onDelete(entry)
        onClose()
    }

    const handleCopy = () => {
        onCopy(entry)
        onClose()
    }

    const handleToggleTodo = () => {
        onToggleTodo(entry.id)
        onClose()
    }

    const isNote = entry.type === ENTRY_TYPES.NOTE

    return (
        <div
            ref={menuRef}
            className="fixed min-w-[160px] p-1 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg shadow-lg z-500 animate-slide-in font-mono"
            style={{
                left: position.x,
                top: position.y
            }}
        >
            <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-[var(--text-muted)] border-b border-[var(--border-subtle)] mb-1">
                <span className="uppercase tracking-wider font-bold">ACTION</span>
            </div>

            {/* Toggle TODO - only for notes */}
            {isNote && (
                <button
                    className="flex items-center gap-3 w-full px-3 py-1.5 text-xs text-[var(--text-primary)] bg-transparent border-none cursor-pointer transition-colors text-left hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent)]"
                    onClick={handleToggleTodo}
                >
                    <span className="opacity-50">[T]</span>
                    {entry.isTodo ? 'UNMARK TODO' : 'MARK AS TODO'}
                </button>
            )}

            <button
                className="flex items-center gap-3 w-full px-3 py-1.5 text-xs text-[var(--text-primary)] bg-transparent border-none cursor-pointer transition-colors text-left hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent)]"
                onClick={handleEdit}
            >
                <span className="opacity-50">[E]</span>
                EDIT
            </button>

            <button
                className="flex items-center gap-3 w-full px-3 py-1.5 text-xs text-[var(--text-primary)] bg-transparent border-none cursor-pointer transition-colors text-left hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent)]"
                onClick={handleCopy}
            >
                <span className="opacity-50">[Y]</span>
                COPY
            </button>

            <div className="h-px mx-1 my-1 bg-[var(--border-subtle)]"></div>

            <button
                className="flex items-center gap-3 w-full px-3 py-1.5 text-xs text-[var(--error)] bg-transparent border-none cursor-pointer transition-colors text-left hover:bg-[var(--bg-tertiary)]"
                onClick={handleDelete}
            >
                <span className="opacity-50">[D]</span>
                DELETE
            </button>
        </div>
    )
}
