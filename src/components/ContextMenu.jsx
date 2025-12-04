import { useEffect, useRef, useState } from 'react'

export function ContextMenu({ isOpen, position, entry, onClose, onEdit, onDelete, onCopy, onSetCategory, categories }) {
    const menuRef = useRef(null)
    const [showCategories, setShowCategories] = useState(false)

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

    // Reset submenu when menu closes
    useEffect(() => {
        if (!isOpen) {
            setShowCategories(false)
        }
    }, [isOpen])

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

    const handleCategorySelect = (categoryId) => {
        onSetCategory(entry.id, categoryId)
        onClose()
    }

    const currentCategory = categories?.find(c => c.id === entry.category)

    return (
        <div
            ref={menuRef}
            className="fixed min-w-[180px] p-1 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-[4px] shadow-lg z-500 animate-slide-in font-mono"
            style={{
                left: position.x,
                top: position.y
            }}
        >
            <div className="px-2 py-1 text-[10px] text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-subtle)] mb-1">
                ACTION_MENU
            </div>

            {/* Category selector */}
            <div className="relative">
                <button
                    className="flex items-center justify-between gap-2 w-full px-3 py-1.5 text-xs text-[var(--text-primary)] bg-transparent border-none cursor-pointer transition-colors text-left hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent)]"
                    onClick={() => setShowCategories(!showCategories)}
                >
                    <span className="flex items-center gap-2">
                        <span className="opacity-50">[C]</span>
                        CATEGORY
                    </span>
                    {currentCategory && (
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: currentCategory.color }}
                        ></span>
                    )}
                </button>

                {showCategories && categories && (
                    <div className="absolute left-full top-0 ml-1 min-w-[140px] p-1 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-[4px] shadow-lg">
                        <button
                            className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs bg-transparent border-none cursor-pointer transition-colors text-left hover:bg-[var(--bg-tertiary)] ${!entry.category ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
                            onClick={() => handleCategorySelect(null)}
                        >
                            <span className="w-2 h-2 rounded-full bg-[var(--text-dim)]"></span>
                            None
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs bg-transparent border-none cursor-pointer transition-colors text-left hover:bg-[var(--bg-tertiary)] ${entry.category === cat.id ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}
                                onClick={() => handleCategorySelect(cat.id)}
                            >
                                <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: cat.color }}
                                ></span>
                                {cat.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

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
