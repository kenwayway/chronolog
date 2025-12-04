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
    const [isFocused, setIsFocused] = useState(false)
    const [textareaHeight, setTextareaHeight] = useState(24)
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
        setTextareaHeight(24)
        inputRef.current?.focus()
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit('note')
        } else if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault()
            if (!isStreaming) {
                handleSubmit('logIn')
            } else {
                handleSubmit('logOff')
            }
        }
    }

    // Calculate textarea height on input change
    useEffect(() => {
        if (inputRef.current) {
            // Reset to minimum to get accurate scrollHeight
            inputRef.current.style.height = '24px'
            const scrollHeight = inputRef.current.scrollHeight
            const newHeight = Math.min(Math.max(scrollHeight, 24), 200)
            setTextareaHeight(newHeight)
            inputRef.current.style.height = newHeight + 'px'
        }
    }, [input])

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-300 pointer-events-none"
            style={{ paddingBottom: 0 }}
        >
            <div
                className="max-w-4xl mx-auto px-4 pb-3 pt-3 bg-[var(--bg-primary)] border-t border-[var(--border-subtle)] pointer-events-auto"
                style={{
                    transform: 'translateY(0)',
                    transition: 'all 150ms ease-out'
                }}
            >
                {/* Main input area */}
                <div className={`flex items-end gap-3 p-3 bg-[var(--bg-secondary)] border rounded-[4px] transition-all duration-150 ${isFocused ? 'border-[var(--accent)] shadow-[0_0_0_1px_var(--accent-subtle)]' : 'border-[var(--border-light)]'}`}>
                    {/* Prompt Symbol */}
                    <div className="flex-shrink-0 pb-0.5 text-[var(--accent)] font-bold select-none text-sm">
                        {isStreaming ? '➜' : '❯'}
                    </div>

                    {/* Input Area - grows upward */}
                    <div className="flex-1 relative flex flex-col justify-end">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            placeholder={isStreaming ? "Add note..." : "What are you working on?"}
                            rows={1}
                            className="w-full bg-transparent text-[var(--text-primary)] font-mono text-sm resize-none focus:outline-none placeholder:text-[var(--text-dim)] leading-relaxed overflow-y-auto"
                            style={{
                                height: textareaHeight + 'px',
                                minHeight: '24px',
                                maxHeight: '200px'
                            }}
                        />
                    </div>

                    {/* Action buttons */}
                    <div className="flex-shrink-0 flex items-center gap-1 pb-0.5">
                        {aiLoading && (
                            <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-pulse mr-2"></span>
                        )}

                        {!isStreaming ? (
                            <button
                                className="px-2 py-1 text-[10px] font-bold text-[var(--bg-primary)] bg-[var(--accent)] rounded-[3px] cursor-pointer hover:bg-[var(--accent-light)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors uppercase tracking-wide"
                                onClick={() => handleSubmit('logIn')}
                                disabled={!input.trim()}
                                title="Ctrl+Enter"
                            >
                                START
                            </button>
                        ) : (
                            <button
                                className="px-2 py-1 text-[10px] font-bold text-[var(--error)] bg-transparent border border-[var(--error)] rounded-[3px] cursor-pointer hover:bg-[var(--error)] hover:text-[var(--bg-primary)] transition-colors uppercase tracking-wide"
                                onClick={() => handleSubmit('logOff')}
                                title="Ctrl+Enter"
                            >
                                END
                            </button>
                        )}
                    </div>
                </div>

                {/* Status bar */}
                <div className="flex items-center justify-between mt-2 px-1">
                    <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--text-dim)]">
                        <div className={`flex items-center gap-1.5 ${isStreaming ? 'text-[var(--streaming)]' : ''}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-[var(--streaming)] animate-pulse' : 'bg-[var(--text-dim)]'}`}></div>
                            <span className="uppercase tracking-wider">{isStreaming ? 'ACTIVE' : 'IDLE'}</span>
                        </div>

                        {!hasApiKey && (
                            <span className="opacity-50">NO_API</span>
                        )}
                    </div>

                    <div className="text-[10px] font-mono text-[var(--text-dim)] opacity-50">
                        <span>↵ note</span>
                        <span className="mx-2">·</span>
                        <span>^↵ {isStreaming ? 'end' : 'start'}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
