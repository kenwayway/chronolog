import { useEffect, useRef } from 'react'
import './ContextMenu.css'

export function ContextMenu({
    isOpen,
    position,
    entry,
    onClose,
    onEdit,
    onDelete,
    onCopy
}) {
    const menuRef = useRef(null)

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return

        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose()
            }
        }

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEscape)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [isOpen, onClose])

    // Adjust position to stay within viewport
    useEffect(() => {
        if (!isOpen || !menuRef.current) return

        const menu = menuRef.current
        const rect = menu.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight

        let adjustedX = position.x
        let adjustedY = position.y

        if (position.x + rect.width > viewportWidth) {
            adjustedX = viewportWidth - rect.width - 16
        }

        if (position.y + rect.height > viewportHeight) {
            adjustedY = viewportHeight - rect.height - 16
        }

        menu.style.left = `${adjustedX}px`
        menu.style.top = `${adjustedY}px`
    }, [isOpen, position])

    if (!isOpen || !entry) return null

    const handleAction = (action) => {
        action()
        onClose()
    }

    return (
        <div
            ref={menuRef}
            className="context-menu glass"
            style={{ left: position.x, top: position.y }}
        >
            <button
                className="menu-item"
                onClick={() => handleAction(() => onEdit(entry))}
            >
                <span className="menu-icon">✎</span>
                Edit
            </button>

            <button
                className="menu-item"
                onClick={() => handleAction(() => onCopy(entry))}
            >
                <span className="menu-icon">◫</span>
                Copy
            </button>

            <div className="menu-divider" />

            <button
                className="menu-item danger"
                onClick={() => handleAction(() => onDelete(entry))}
            >
                <span className="menu-icon">✕</span>
                Delete
            </button>
        </div>
    )
}
