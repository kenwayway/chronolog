import { useState, useRef, useEffect } from 'react'
import { SESSION_STATUS } from '../utils/constants'

export function InputPanel({
    status,
    onLogIn,
    onSwitch,
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
            case 'switch':
                onSwitch(input.trim())
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
        // Enter = NOTE
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
            e.preventDefault()
            handleSubmit('note')
        }
        // Ctrl+Enter = LOG IN / SWITCH (starts new session)
        else if (e.key === 'Enter' && e.ctrlKey && !e.shiftKey) {
            e.preventDefault()
            if (!isStreaming) {
                handleSubmit('logIn')
            } else {
                handleSubmit('switch')
            }
        }
        // Ctrl+Shift+Enter = LOG OFF (only when streaming)
        else if (e.key === 'Enter' && e.ctrlKey && e.shiftKey) {
            e.preventDefault()
            if (isStreaming) {
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
        <div className="fixed bottom-0 left-0 right-0 z-300 bg-[var(--bg-primary)] border-t border-[var(--border-subtle)]">
            <div className="max-w-4xl mx-auto px-4 py-4">
                <div className="flex flex-col gap-3">
                    {/* Input Area */}
                    <div className="relative flex items-start gap-3">
                        <div className="flex-shrink-0 pt-1 text-[var(--accent)] font-bold select-none text-sm">
                            {isStreaming ? '➜' : '❯'}
                        </div>
                        <div className="flex-1">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                placeholder={isStreaming ? "Add note or switch session..." : "What are you working on?"}
                                rows={1}
                                className="w-full bg-transparent text-[var(--text-primary)] font-mono text-[15px] resize-none focus:outline-none placeholder:text-[var(--text-dim)] leading-relaxed overflow-y-auto transition-all duration-200 ease-in-out"
                                style={{
                                    height: isFocused ? Math.max(textareaHeight, 80) + 'px' : textareaHeight + 'px',
                                    minHeight: isFocused ? '80px' : '24px',
                                    maxHeight: '300px'
                                }}
                            />
                        </div>
                    </div>

                    {/* Bottom Bar: Status & Actions */}
                    <div className="flex-between pl-6">
                        {/* Status Indicators */}
                        <div className="flex items-center gap-4 text-[10px] font-mono text-[var(--text-dim)]">
                            <div className={`flex items-center gap-1.5 ${isStreaming ? 'text-[var(--streaming)]' : ''}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-[var(--streaming)] animate-pulse' : 'bg-[var(--text-dim)]'}`}></div>
                                <span className="uppercase tracking-wider">{isStreaming ? 'ACTIVE' : 'IDLE'}</span>
                            </div>

                            {aiLoading && (
                                <div className="flex items-center gap-1.5 text-[var(--accent)]">
                                    <span className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-pulse"></span>
                                    <span className="uppercase tracking-wider">AI_PROCESSING</span>
                                </div>
                            )}

                            {!hasApiKey && (
                                <span className="opacity-50">NO_API</span>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-4 font-mono text-[10px]">
                            {/* NOTE button */}
                            <button
                                className="text-[var(--text-dim)] hover:text-[var(--text-primary)] cursor-pointer bg-transparent border-none uppercase tracking-wider transition-colors disabled:opacity-30"
                                onClick={() => handleSubmit('note')}
                                disabled={!input.trim()}
                                title="Enter"
                            >
                                [ NOTE ]
                            </button>

                            {/* LOG OFF button */}
                            {isStreaming && (
                                <button
                                    className="text-[var(--error)] hover:text-[var(--error)]/80 cursor-pointer bg-transparent border-none uppercase tracking-wider transition-colors"
                                    onClick={() => handleSubmit('logOff')}
                                    title="Ctrl+Shift+Enter"
                                >
                                    [ LOG OFF ]
                                </button>
                            )}

                            {/* LOG IN / SWITCH button */}
                            <button
                                className="text-[var(--accent)] hover:text-[var(--accent-light)] cursor-pointer bg-transparent border-none uppercase tracking-wider transition-colors disabled:opacity-30"
                                onClick={() => handleSubmit(isStreaming ? 'switch' : 'logIn')}
                                disabled={!input.trim()}
                                title="Ctrl+Enter"
                            >
                                [ {isStreaming ? 'SWITCH' : 'LOG IN'} ]
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

