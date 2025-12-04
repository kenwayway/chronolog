import { useState, useRef, useEffect } from 'react'

export function EditModal({ isOpen, entry, onSave, onClose }) {
    const [content, setContent] = useState('')
    const textareaRef = useRef(null)

    useEffect(() => {
        if (isOpen && entry) {
            setContent(entry.content || '')
            // Focus and select all after render
            setTimeout(() => {
                textareaRef.current?.focus()
                textareaRef.current?.select()
            }, 50)
        }
    }, [isOpen, entry])

    if (!isOpen || !entry) return null

    const handleSave = () => {
        if (content !== entry.content) {
            onSave(entry.id, content)
        }
        onClose()
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onClose()
        } else if (e.key === 'Enter' && e.ctrlKey) {
            handleSave()
        }
    }

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    return (
        <div
            className="fixed inset-0 flex-center p-6 bg-black/70 backdrop-blur-sm z-400 font-mono"
            onClick={handleBackdropClick}
            onKeyDown={handleKeyDown}
        >
            <div className="w-full max-w-[600px] bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-[4px] shadow-2xl">
                <div className="flex-between px-4 py-3 border-b border-[var(--border-light)]">
                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">[EDIT_ENTRY]</span>
                    <button
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer bg-transparent border-none text-lg"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <div className="p-4">
                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full min-h-[150px] p-3 bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono text-sm border border-[var(--border-light)] rounded-[2px] resize-y focus:outline-none focus:border-[var(--accent)] leading-relaxed"
                        placeholder="Enter content..."
                    />
                </div>

                <div className="flex justify-between items-center px-4 py-3 border-t border-[var(--border-light)]">
                    <span className="text-[10px] text-[var(--text-dim)]">
                        CTRL+ENTER to save • ESC to cancel
                    </span>
                    <div className="flex gap-3">
                        <button
                            className="btn btn-ghost uppercase tracking-wide"
                            onClick={onClose}
                        >
                            CANCEL
                        </button>
                        <button
                            className="btn btn-primary uppercase tracking-wide"
                            onClick={handleSave}
                        >
                            SAVE
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
