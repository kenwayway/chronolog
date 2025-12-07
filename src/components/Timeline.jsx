import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { ENTRY_TYPES } from '../utils/constants'
import { formatTime, formatDuration, formatDate } from '../utils/formatters'
import { useTheme } from '../hooks/useTheme.jsx'

export function Timeline({ entries, status, categories, onContextMenu }) {
    const { theme } = useTheme()
    const sortedEntries = [...entries].sort((a, b) => a.timestamp - b.timestamp)

    // Build session durations map
    const sessionDurations = {}
    let currentSessionStartId = null

    // Calculate line states
    const entryLineStates = {}
    let inSession = false

    for (const entry of sortedEntries) {
        if (entry.type === ENTRY_TYPES.SESSION_START) {
            currentSessionStartId = entry.id
        } else if (entry.type === ENTRY_TYPES.SESSION_END && currentSessionStartId) {
            sessionDurations[currentSessionStartId] = entry.duration
            currentSessionStartId = null
        }

        let state = 'default'
        if (entry.type === ENTRY_TYPES.SESSION_START) {
            inSession = true
            state = 'start'
        } else if (entry.type === ENTRY_TYPES.SESSION_END) {
            inSession = false
            state = 'end'
        } else if (inSession) {
            state = 'active'
        }
        entryLineStates[entry.id] = state
    }

    // Group by date
    const groupedEntries = sortedEntries.reduce((acc, entry) => {
        const dateKey = new Date(entry.timestamp).toDateString()
        if (!acc[dateKey]) acc[dateKey] = []
        acc[dateKey].push(entry)
        return acc
    }, {})

    const dateGroups = Object.keys(groupedEntries).sort((a, b) => new Date(a) - new Date(b))
    const isToday = (dateStr) => new Date(dateStr).toDateString() === new Date().toDateString()

    return (
        <div className="timeline-container" style={{ flex: 1, overflowY: 'auto', padding: '24px 16px 160px', fontFamily: 'monospace' }}>
            {entries.length === 0 && (
                <div className="flex flex-col items-center justify-center" style={{ height: 256, color: 'var(--text-muted)', textAlign: 'center', opacity: 0.5 }}>
                    <div style={{ fontSize: 32, marginBottom: 16 }}>_</div>
                    <p style={{ fontSize: 14 }}>System initialized.</p>
                    <p style={{ fontSize: 12, marginTop: 8 }}>Waiting for input...</p>
                </div>
            )}

            {sortedEntries.map((entry, index) => (
                <TimelineEntry
                    key={entry.id}
                    entry={entry}
                    isFirst={index === 0}
                    isLast={index === sortedEntries.length - 1}
                    sessionDuration={sessionDurations[entry.id]}
                    categories={categories}
                    onContextMenu={onContextMenu}
                    lineState={entryLineStates[entry.id]}
                    isLightMode={theme.mode === 'light'}
                />
            ))}
        </div>
    )
}

function TimelineEntry({ entry, isFirst, isLast, sessionDuration, categories, onContextMenu, lineState, isLightMode }) {
    const [pressTimer, setPressTimer] = useState(null)

    const handleContextMenu = (e) => {
        e.preventDefault()
        onContextMenu?.(entry, { x: e.clientX, y: e.clientY })
    }

    const handleTouchStart = (e) => {
        const timer = setTimeout(() => {
            const touch = e.touches[0]
            onContextMenu?.(entry, { x: touch.clientX, y: touch.clientY })
        }, 500)
        setPressTimer(timer)
    }

    const handleTouchEnd = () => {
        if (pressTimer) {
            clearTimeout(pressTimer)
            setPressTimer(null)
        }
    }

    const getEntrySymbol = () => {
        const styles = { fontSize: 14 }
        switch (entry.type) {
            case ENTRY_TYPES.SESSION_START:
                return <span style={{ ...styles, color: 'var(--success)', fontWeight: 700, fontSize: 18 }}>»</span>
            case ENTRY_TYPES.SESSION_END:
                return <span style={{ ...styles, color: 'var(--text-muted)' }}>■</span>
            case ENTRY_TYPES.NOTE:
                return <span style={{ ...styles, color: 'var(--text-dim)' }}>{entry.isTodo ? '○' : '·'}</span>
            case ENTRY_TYPES.TASK_DONE:
                return <span style={{ ...styles, color: 'var(--success)', fontWeight: 700 }}>✓</span>
            default:
                return <span style={{ ...styles, color: 'var(--text-dim)' }}>·</span>
        }
    }

    // Darken color for light mode visibility
    const darkenColor = (hex, percent) => {
        const num = parseInt(hex.slice(1), 16)
        const r = Math.max(0, (num >> 16) - Math.round(255 * percent / 100))
        const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * percent / 100))
        const b = Math.max(0, (num & 0xff) - Math.round(255 * percent / 100))
        return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`
    }

    const category = categories?.find(c => c.id === entry.category)
    const categoryTextColor = category ? (isLightMode ? darkenColor(category.color, 10) : category.color) : null
    const isSessionStart = entry.type === ENTRY_TYPES.SESSION_START
    const isSessionEnd = entry.type === ENTRY_TYPES.SESSION_END
    const isTaskDone = entry.type === ENTRY_TYPES.TASK_DONE
    const isTodo = entry.isTodo

    const linkifyContent = (text) => {
        if (!text) return null

        // Split by lines first to handle image lines specially
        const lines = text.split('\n')

        return lines.map((line, lineIdx) => {
            // Check if this is an image line (🖼️ prefix)
            if (line.startsWith('🖼️ ')) {
                const imageUrl = line.replace('🖼️ ', '').trim()
                return (
                    <div key={lineIdx} style={{ marginTop: 8, marginBottom: 4 }}>
                        <img
                            src={imageUrl}
                            alt="attached"
                            style={{
                                maxWidth: '100%',
                                maxHeight: 300,
                                borderRadius: 8,
                                border: '1px solid var(--border-subtle)'
                            }}
                            onError={(e) => {
                                e.target.style.display = 'none'
                                e.target.nextSibling.style.display = 'inline'
                            }}
                        />
                        <a href={imageUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'none', color: 'var(--accent)', fontSize: 12 }}>{imageUrl}</a>
                    </div>
                )
            }

            // Check if this is a location line (📍 prefix)
            if (line.startsWith('📍 ')) {
                return (
                    <div key={lineIdx} style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{line.replace('📍 ', '')}</span>
                    </div>
                )
            }

            // Regular line with URL linkification
            const urlRegex = /(https?:\/\/[^\s]+)/g
            const parts = line.split(urlRegex)
            const linkedParts = parts.map((part, i) => {
                if (part.match(urlRegex)) {
                    return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', wordBreak: 'break-all' }} onClick={(e) => e.stopPropagation()}>{part}</a>
                }
                return part
            })

            return lineIdx < lines.length - 1
                ? <span key={lineIdx}>{linkedParts}{'\n'}</span>
                : <span key={lineIdx}>{linkedParts}</span>
        })
    }

    const getLineColor = (position) => {
        if (position === 'top') {
            return (lineState === 'start' || lineState === 'default') ? 'var(--border-light)' : 'var(--accent)'
        }
        return (lineState === 'end' || lineState === 'default') ? 'var(--border-light)' : 'var(--accent)'
    }

    const getContentColor = () => {
        if (isSessionStart) return 'var(--text-primary)'
        if (isSessionEnd) return 'var(--text-muted)'
        if (isTodo) return 'var(--warning)'
        if (isTaskDone) return 'var(--text-muted)'
        return 'var(--text-secondary)'
    }

    return (
        <div
            className="timeline-entry"
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                padding: '12px',
                margin: '0 -12px',
                borderRadius: 4,
                cursor: 'default',
                userSelect: 'text',
                opacity: isTaskDone ? 0.7 : 1,
                transition: 'background-color 150ms ease'
            }}
            onContextMenu={handleContextMenu}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
        >
            {/* Timestamp */}
            <div className="timeline-timestamp" style={{ flexShrink: 0, width: 56, fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', paddingTop: 4, fontFamily: 'monospace', opacity: 0.6 }}>
                {formatTime(entry.timestamp)}
            </div>

            {/* Symbol Column */}
            <div className="timeline-symbol-col" style={{ position: 'relative', flexShrink: 0, width: 20, textAlign: 'center', fontSize: 14, userSelect: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'stretch' }}>
                {!isFirst && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', width: 1, height: 24, backgroundColor: getLineColor('top') }} />}
                {!isLast && <div style={{ position: 'absolute', top: 12, bottom: -12, left: '50%', transform: 'translateX(-50%)', width: 1, backgroundColor: getLineColor('bottom') }} />}
                <div style={{ position: 'relative', zIndex: 10, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: 'var(--bg-primary)' }}>
                    {getEntrySymbol()}
                </div>
            </div>

            {/* Content */}
            <div className="timeline-content-col" style={{ flex: 1, minWidth: 0 }}>
                {/* Mobile timestamp - visible only on mobile via CSS */}
                <div className="timeline-mobile-time" style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace', marginBottom: 4, display: 'none' }}>
                    {formatTime(entry.timestamp)}
                </div>
                <div className="flex flex-wrap items-baseline" style={{ gap: '4px 12px', marginBottom: 6 }}>
                    {entry.content && (
                        <span className="timeline-content-text" style={{
                            fontSize: 15,
                            lineHeight: 1.6,
                            overflowWrap: 'break-word',
                            fontFamily: 'Inter, sans-serif',
                            whiteSpace: 'pre-wrap',
                            color: getContentColor(),
                            fontStyle: isSessionEnd ? 'italic' : 'normal',
                            textDecoration: isTaskDone ? 'line-through' : 'none'
                        }}>
                            {linkifyContent(entry.content)}
                        </span>
                    )}

                    {isSessionStart && sessionDuration && (
                        <span style={{ fontSize: 11, color: 'var(--accent)', backgroundColor: 'var(--accent-subtle)', padding: '2px 6px', borderRadius: 3, userSelect: 'none', fontWeight: 500 }}>
                            {formatDuration(sessionDuration)}
                        </span>
                    )}

                    {isTaskDone && <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700, userSelect: 'none' }}>[DONE]</span>}
                    {isTodo && <span style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 700, userSelect: 'none' }}>[TODO]</span>}
                </div>

                {category && (
                    <div style={{ marginTop: 6 }}>
                        <span style={{
                            fontSize: 11,
                            padding: '3px 10px',
                            borderRadius: 3,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            userSelect: 'none',
                            letterSpacing: '0.05em',
                            color: categoryTextColor,
                            backgroundColor: `${category.color}20`,
                            border: `1px solid ${category.color}40`
                        }}>
                            #{category.label}
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}
