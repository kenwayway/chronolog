import { useState, useRef, useEffect } from 'react'

export function EditModal({ isOpen, entry, onSave, onClose, categories }) {
    const [content, setContent] = useState('')
    const [timestamp, setTimestamp] = useState('')
    const [category, setCategory] = useState(null)
    const textareaRef = useRef(null)

    useEffect(() => {
        if (isOpen && entry) {
            setContent(entry.content || '')
            const date = new Date(entry.timestamp)
            const localISOTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
            setTimestamp(localISOTime)
            setCategory(entry.category || null)
            setTimeout(() => textareaRef.current?.focus(), 50)
        }
    }, [isOpen, entry])

    if (!isOpen || !entry) return null

    const handleSave = () => {
        const newTimestamp = new Date(timestamp).getTime()
        onSave(entry.id, {
            content: content !== entry.content ? content : undefined,
            timestamp: newTimestamp !== entry.timestamp ? newTimestamp : undefined,
            category: category !== entry.category ? category : undefined
        })
        onClose()
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose()
        else if (e.key === 'Enter' && e.ctrlKey) handleSave()
    }

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose()
    }

    const inputStyle = {
        height: 32,
        padding: '0 0.75rem',
        fontSize: '0.75rem',
        backgroundColor: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        border: 'none',
        borderRadius: 6,
        outline: 'none'
    }

    return (
        <div
            className="fixed inset-0 flex-center font-mono"
            style={{ padding: 16, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 400 }}
            onClick={handleBackdropClick}
            onKeyDown={handleKeyDown}
        >
            <div style={{
                width: '100%',
                maxWidth: 480,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: 12,
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}>
                {/* Header */}
                <div className="flex-between" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>EDIT ENTRY</span>
                    <button
                        onClick={onClose}
                        style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', backgroundColor: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 18 }}
                    >×</button>
                </div>

                <div style={{ padding: 16 }} className="space-y-4">
                    {/* Content */}
                    <div>
                        <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>CONTENT</label>
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Enter content..."
                            style={{
                                width: '100%',
                                minHeight: 120,
                                padding: 12,
                                fontSize: 14,
                                lineHeight: 1.6,
                                backgroundColor: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-light)',
                                borderRadius: 6,
                                resize: 'vertical',
                                outline: 'none'
                            }}
                        />
                    </div>

                    {/* Time and Category */}
                    <div className="flex gap-3">
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>TIME</label>
                            <input
                                type="datetime-local"
                                value={timestamp}
                                onChange={(e) => setTimestamp(e.target.value)}
                                style={{ ...inputStyle, width: '100%' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>CATEGORY</label>
                            <div className="flex gap-1-5 flex-wrap">
                                <button
                                    onClick={() => setCategory(null)}
                                    style={{
                                        width: 24, height: 24, borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 10, backgroundColor: 'var(--text-dim)', border: !category ? '2px solid white' : 'none',
                                        boxShadow: !category ? '0 0 0 2px rgba(255,255,255,0.3)' : 'none', color: 'white'
                                    }}
                                >{!category && '×'}</button>
                                {categories?.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setCategory(cat.id)}
                                        title={cat.label}
                                        style={{
                                            width: 24, height: 24, borderRadius: 4, cursor: 'pointer', backgroundColor: cat.color,
                                            border: category === cat.id ? '2px solid white' : 'none',
                                            boxShadow: category === cat.id ? '0 0 0 2px rgba(255,255,255,0.3)' : 'none'
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-between" style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Ctrl+Enter to save</span>
                    <div className="flex gap-2">
                        <button onClick={onClose} style={{ height: 32, padding: '0 16px', fontSize: 12, color: 'var(--text-muted)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={handleSave} style={{ height: 32, padding: '0 16px', fontSize: 12, fontWeight: 500, color: 'white', backgroundColor: 'var(--accent)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Save</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
