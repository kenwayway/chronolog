import { useState, useRef, useEffect } from 'react'
import { SESSION_STATUS } from '../utils/constants'

export function InputPanel({
    status,
    onLogIn,
    onNote,
    onLogOff,
    aiLoading,
    hasApiKey
}) {
    const [input, setInput] = useState('')
    const inputRef = useRef(null)
    const isStreaming = status === SESSION_STATUS.STREAMING

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    const handleSubmit = (action) => {
        if (!input.trim() && action !== 'logOff') return

        switch (action) {
            case 'logIn':
                onLogIn(input.trim())
                break
            case 'note':
                onNote(input.trim())
                break
            case 'logOff':
                onLogOff(input.trim())
                break
        }

        setInput('')
        inputRef.current?.focus()
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit('note')
        }
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 px-6 py-4 glass backdrop-blur-20 border-t border-[var(--border-subtle)] z-300">
            <div className="max-w-800px mx-auto flex gap-4 items-end">
                <div className="flex-1 relative">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isStreaming ? "Add a note..." : "What's on your mind?"}
                        rows={1}
                        className="input-field min-h-12 max-h-30 resize-none"
                    />

                    {aiLoading && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-600 text-[var(--accent)] tracking-wide">
                            <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-pulse"></span>
                            AI
                        </div>
                    )}
                </div>

                <div className="flex gap-2 flex-shrink-0">
                    <button
                        className="btn-secondary whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={() => handleSubmit('note')}
                        disabled={!input.trim()}
                    >
                        <span className="text-2.5">+</span>
                        NOTE
                    </button>

                    {!isStreaming ? (
                        <button
                            className="btn-primary whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                            onClick={() => handleSubmit('logIn')}
                            disabled={!input.trim()}
                        >
                            <span className="text-2.5">▶</span>
                            LOG IN
                        </button>
                    ) : (
                        <button
                            className="btn-danger whitespace-nowrap"
                            onClick={() => handleSubmit('logOff')}
                        >
                            <span className="text-2.5">■</span>
                            LOG OFF
                        </button>
                    )}
                </div>
            </div>

            {!hasApiKey && (
                <div className="flex items-center justify-center gap-2 mt-2 pt-2 text-xs text-[var(--text-muted)] border-t border-[var(--border-subtle)]">
                    <span className="text-sm">💡</span>
                    <span>Add Gemini API key for AI-powered TODO detection</span>
                </div>
            )}
        </div>
    )
}
