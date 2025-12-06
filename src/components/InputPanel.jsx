import { useState, useRef, useEffect } from 'react'
import { StickyNote, Square, Play, ArrowRightLeft } from 'lucide-react'
import { SESSION_STATUS } from '../utils/constants'

export function InputPanel({ status, onLogIn, onSwitch, onNote, onLogOff }) {
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
            case 'logIn': onLogIn(input.trim()); break
            case 'switch': onSwitch(input.trim()); break
            case 'note': onNote(input.trim()); break
            case 'logOff': onLogOff(input.trim()); break
        }
        setInput('')
        setTextareaHeight(24)
        inputRef.current?.focus()
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
            e.preventDefault()
            handleSubmit('note')
        } else if (e.key === 'Enter' && e.ctrlKey && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(isStreaming ? 'switch' : 'logIn')
        } else if (e.key === 'Enter' && e.ctrlKey && e.shiftKey && isStreaming) {
            e.preventDefault()
            handleSubmit('logOff')
        }
    }

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = '24px'
            const scrollHeight = inputRef.current.scrollHeight
            const newHeight = Math.min(Math.max(scrollHeight, 24), 200)
            setTextareaHeight(newHeight)
            inputRef.current.style.height = newHeight + 'px'
        }
    }, [input])

    const actionBtnStyle = {
        fontSize: 10,
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        transition: 'color 150ms ease'
    }

    return (
        <div
            className="fixed z-300"
            style={{ bottom: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center', padding: '0 16px', pointerEvents: 'none' }}
        >
            <div style={{ width: '100%', maxWidth: 768, pointerEvents: 'auto' }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 12,
                    boxShadow: isFocused ? '0 0 30px rgba(0,0,0,0.2)' : '0 25px 50px -12px rgba(0,0,0,0.25)',
                    overflow: 'hidden',
                    transition: 'all 350ms cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                    {/* Input Area */}
                    <div className="flex items-stretch" style={{ backgroundColor: 'var(--bg-primary)' }}>
                        {/* Gutter */}
                        <div style={{
                            flexShrink: 0,
                            width: 48,
                            paddingTop: 12,
                            paddingRight: 12,
                            textAlign: 'right',
                            borderRight: '1px solid var(--border-subtle)',
                            backgroundColor: 'var(--bg-secondary)',
                            userSelect: 'none'
                        }}>
                            <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 14, fontFamily: 'monospace' }}>
                                {isStreaming ? '➜' : '❯'}
                            </span>
                        </div>

                        {/* Editor */}
                        <div style={{ flex: 1, padding: '12px 0 12px 12px' }}>
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                placeholder={isStreaming ? "Add note or switch session..." : "What are you working on?"}
                                rows={1}
                                style={{
                                    width: '100%',
                                    backgroundColor: 'transparent',
                                    color: 'var(--text-primary)',
                                    fontFamily: 'monospace',
                                    fontSize: 15,
                                    resize: 'none',
                                    border: 'none',
                                    outline: 'none',
                                    lineHeight: 1.6,
                                    overflowY: 'auto',
                                    height: isFocused ? Math.max(textareaHeight, 80) + 'px' : '24px',
                                    minHeight: isFocused ? 80 : 24,
                                    maxHeight: 300,
                                    transition: 'height 350ms cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                            />
                        </div>
                    </div>

                    {/* Bottom Bar */}
                    <div className="flex-between" style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-secondary)' }}>
                        <div className="flex items-center gap-3" style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            <span style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: isStreaming ? 'var(--success)' : 'var(--text-dim)'
                            }} />
                            <span className="uppercase tracking-wider">{isStreaming ? 'SESSION ACTIVE' : 'READY'}</span>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Note button */}
                            <button
                                className="btn-action btn-action-secondary"
                                onClick={() => handleSubmit('note')}
                                disabled={!input.trim()}
                            ><StickyNote size={12} /> NOTE</button>

                            {/* Log Off button */}
                            {isStreaming && (
                                <button
                                    className="btn-action btn-action-danger"
                                    onClick={() => handleSubmit('logOff')}
                                ><Square size={12} /> LOG OFF</button>
                            )}

                            {/* Primary action button */}
                            <button
                                className="btn-action btn-action-primary"
                                onClick={() => handleSubmit(isStreaming ? 'switch' : 'logIn')}
                                disabled={!input.trim()}
                            >{isStreaming ? <><ArrowRightLeft size={12} /> SWITCH</> : <><Play size={12} /> LOG IN</>}</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
