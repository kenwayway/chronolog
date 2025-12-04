import { useEffect, useRef } from 'react'

export function ContextMenu({ isOpen, position, entry, onClose, onEdit, onDelete, onCopy }) {
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

    return (
        <div
            ref={menuRef}
            className="fixed min-w-40 p-1 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg shadow-lg z-500 animate-slide-in"
            style={{
                left: position.x,
                top: position.y
            }}
        >
            <button
                className="flex items-center gap-2 w-full px-4 py-2 font-sans text-sm text-[var(--text-primary)] bg-transparent border-none rounded cursor-pointer transition-colors duration-150 text-left hover:bg-[var(--bg-tertiary)]"
                onClick={handleEdit}
            >
                <span className="text-xs opacity-70">✏</span>
                Edit
            </button>

            <button
                className="flex items-center gap-2 w-full px-4 py-2 font-sans text-sm text-[var(--text-primary)] bg-transparent border-none rounded cursor-pointer transition-colors duration-150 text-left hover:bg-[var(--bg-tertiary)]"
                onClick={handleCopy}
            >
                <span className="text-xs opacity-70">📋</span>
                Copy
            </button>

            <div className="h-px mx-2 my-1 bg-[var(--border-subtle)]"></div>

            <button
                className="flex items-center gap-2 w-full px-4 py-2 font-sans text-sm text-[var(--error)] bg-transparent border-none rounded cursor-pointer transition-colors duration-150 text-left hover:bg-red-500/10"
                onClick={handleDelete}
            >
                <span className="text-xs opacity-70">🗑</span>
                Delete
            </button>
        </div>
    )
}
