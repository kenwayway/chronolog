import { useState, useRef, useEffect } from 'react'

export function EditModal({ isOpen, entry, onSave, onClose, categories }) {
    const [content, setContent] = useState('')
    const [timestamp, setTimestamp] = useState('')
    const [category, setCategory] = useState(null)
    const textareaRef = useRef(null)

    useEffect(() => {
        if (isOpen && entry) {
            setContent(entry.content || '')
            // Convert timestamp to datetime-local format
            const date = new Date(entry.timestamp)
            const localISOTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
            setTimestamp(localISOTime)
            setCategory(entry.category || null)
            // Just focus, don't select
            setTimeout(() => {
                textareaRef.current?.focus()
            }, 50)
        }
    }, [isOpen, entry])

    if (!isOpen || !entry) return null

    const handleSave = () => {
        // Convert back to timestamp
        const newTimestamp = new Date(timestamp).getTime()
        onSave(entry.id, {
            content: content !== entry.content ? content : undefined,
            timestamp: newTimestamp !== entry.timestamp ? newTimestamp : undefined,
            category: category !== entry.category ? category : undefined
        })
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
            className="fixed inset-0 flex-center p-4 bg-black/60 backdrop-blur-sm z-400 font-mono"
            onClick={handleBackdropClick}
            onKeyDown={handleKeyDown}
        >
            <div className="w-full max-w-lg bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg shadow-2xl">
                <div className="flex-between px-4 py-3 border-b border-[var(--border-subtle)]">
                    <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">EDIT ENTRY</span>
                    <button
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer bg-transparent border-none text-lg leading-none"
                        onClick={onClose}
                    >×</button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Content */}
                    <div>
                        <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">CONTENT</label>
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full min-h-[120px] p-3 bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm border border-[var(--border-light)] rounded resize-y focus:outline-none focus:border-[var(--accent)] leading-relaxed"
                            placeholder="Enter content..."
                        />
                    </div>

                    {/* Time and Category row */}
                    <div className="flex gap-3">
                        {/* Timestamp */}
                        <div className="flex-1">
                            <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">TIME</label>
                            <input
                                type="datetime-local"
                                value={timestamp}
                                onChange={(e) => setTimestamp(e.target.value)}
                                className="w-full p-2 bg-[var(--bg-primary)] text-[var(--text-primary)] text-xs border border-[var(--border-light)] rounded focus:outline-none focus:border-[var(--accent)]"
                            />
                        </div>

                        {/* Category */}
                        <div className="flex-1">
                            <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">CATEGORY</label>
                            <div className="flex gap-1.5 flex-wrap">
                                <button
                                    onClick={() => setCategory(null)}
                                    className={`w-6 h-6 rounded border cursor-pointer transition-all flex-center text-[10px] ${!category ? 'border-white ring-1 ring-white/30' : 'border-transparent'} bg-[var(--text-dim)]`}
                                    title="None"
                                >
                                    {!category && '×'}
                                </button>
                                {categories?.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setCategory(cat.id)}
                                        className={`w-6 h-6 rounded border cursor-pointer transition-all ${category === cat.id ? 'border-white ring-1 ring-white/30' : 'border-transparent'}`}
                                        style={{ backgroundColor: cat.color }}
                                        title={cat.label}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center px-4 py-3 border-t border-[var(--border-subtle)]">
                    <span className="text-[10px] text-[var(--text-dim)]">
                        Ctrl+Enter to save
                    </span>
                    <div className="flex gap-2">
                        <button
                            className="text-xs text-[var(--text-muted)] px-3 py-1.5 hover:text-[var(--text-primary)] cursor-pointer bg-transparent border-none"
                            onClick={onClose}
                        >
                            CANCEL
                        </button>
                        <button
                            className="text-xs px-3 py-1.5 rounded cursor-pointer border-none bg-[var(--accent)] text-[var(--bg-primary)]"
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
