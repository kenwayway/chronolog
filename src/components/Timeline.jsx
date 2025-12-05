import { useState } from 'react'
import { ENTRY_TYPES } from '../utils/constants'
import { formatTime, formatDuration, formatDate } from '../utils/formatters'

export function Timeline({ entries, status, categories, onContextMenu }) {
    // Sort entries chronologically (oldest first, top to bottom)
    const sortedEntries = [...entries].sort((a, b) => a.timestamp - b.timestamp)

    // Build a map of SESSION_START -> duration (from matching SESSION_END)
    const sessionDurations = {}
    let currentSessionStartId = null

    // Calculate line states
    const entryLineStates = {}
    let inSession = false

    for (const entry of sortedEntries) {
        // Session Duration Logic
        if (entry.type === ENTRY_TYPES.SESSION_START) {
            currentSessionStartId = entry.id
        } else if (entry.type === ENTRY_TYPES.SESSION_END && currentSessionStartId) {
            sessionDurations[currentSessionStartId] = entry.duration
            currentSessionStartId = null
        }

        // Line State Logic
        let state = 'default' // default is gray

        if (entry.type === ENTRY_TYPES.SESSION_START) {
            inSession = true
            state = 'start' // top gray, bottom accent
        } else if (entry.type === ENTRY_TYPES.SESSION_END) {
            inSession = false
            state = 'end' // top accent, bottom gray
        } else if (inSession) {
            state = 'active' // full accent
        }

        entryLineStates[entry.id] = state
    }

    // Group entries by date
    const groupedEntries = sortedEntries.reduce((acc, entry) => {
        const dateKey = new Date(entry.timestamp).toDateString()
        if (!acc[dateKey]) {
            acc[dateKey] = []
        }
        acc[dateKey].push(entry)
        return acc
    }, {})

    // Sort date groups chronologically (oldest first)
    const dateGroups = Object.keys(groupedEntries).sort((a, b) =>
        new Date(a) - new Date(b)
    )

    const isToday = (dateStr) => {
        return new Date(dateStr).toDateString() === new Date().toDateString()
    }

    return (
        <div className="flex-1 overflow-y-auto px-4 py-6 pb-40 font-mono">
            {entries.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)] text-center opacity-50">
                    <div className="text-4xl mb-4">_</div>
                    <p className="text-sm">System initialized.</p>
                    <p className="text-xs mt-2">Waiting for input...</p>
                </div>
            )}

            {dateGroups.map(dateKey => (
                <div key={dateKey} className="mb-8">
                    <div className="flex items-center gap-4 mb-4 text-xs text-[var(--text-muted)] select-none font-mono">
                        <span className="text-[var(--text-dim)] opacity-50">::</span>
                        <span className="uppercase tracking-wider font-bold">
                            {isToday(dateKey) ? 'TODAY' : formatDate(new Date(dateKey).getTime())}
                        </span>
                        <div className="flex-1 h-px bg-[var(--border-subtle)] opacity-50"></div>
                    </div>

                    <div className="space-y-1">
                        {groupedEntries[dateKey].map((entry, index) => (
                            <TimelineEntry
                                key={entry.id}
                                entry={entry}
                                isFirst={index === 0}
                                isLast={index === groupedEntries[dateKey].length - 1}
                                sessionDuration={sessionDurations[entry.id]}
                                categories={categories}
                                onContextMenu={onContextMenu}
                                lineState={entryLineStates[entry.id]}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

function TimelineEntry({ entry, isFirst, isLast, sessionDuration, categories, onContextMenu, lineState }) {
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
        switch (entry.type) {
            case ENTRY_TYPES.SESSION_START:
                return <span className="text-[var(--streaming)] font-bold text-lg">»</span>
            case ENTRY_TYPES.SESSION_END:
                return <span className="text-[var(--text-muted)]">■</span>
            case ENTRY_TYPES.NOTE:
                return <span className="text-[var(--text-dim)]">{entry.isTodo ? '○' : '·'}</span>
            case ENTRY_TYPES.TASK_DONE:
                return <span className="text-[var(--done)] font-bold">✓</span>
            default:
                return <span className="text-[var(--text-dim)]">·</span>
        }
    }

    // Get category info
    const category = categories?.find(c => c.id === entry.category)

    // Styles for different entry types
    const isSessionStart = entry.type === ENTRY_TYPES.SESSION_START
    const isSessionEnd = entry.type === ENTRY_TYPES.SESSION_END
    const isTaskDone = entry.type === ENTRY_TYPES.TASK_DONE
    const isTodo = entry.isTodo

    return (
        <div
            className={`group flex items-start gap-4 py-3 px-3 -mx-3 rounded-[4px] transition-colors duration-150 cursor-default select-text 
                ${isSessionStart ? 'bg-[var(--bg-tertiary)]/30 hover:bg-[var(--bg-tertiary)]/50' : 'hover:bg-[var(--bg-tertiary)]'} 
                ${isTaskDone ? 'opacity-70' : ''}`}
            onContextMenu={handleContextMenu}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
        >
            {/* Timestamp (Line Number Style) */}
            <div className="flex-shrink-0 w-14 text-xs text-[var(--text-muted)] text-right pt-1 font-mono opacity-60 group-hover:opacity-100 transition-opacity">
                {formatTime(entry.timestamp)}
            </div>

            {/* Symbol Column with Line */}
            <div className="relative flex-shrink-0 w-5 text-center text-sm select-none flex flex-col items-center self-stretch">
                {/* Line Top */}
                {!isFirst && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-px h-6 ${lineState === 'start' || lineState === 'default' ? 'bg-[var(--border-subtle)]' : 'bg-[var(--accent)]'
                        }`}></div>
                )}

                {/* Line Bottom */}
                {!isLast && (
                    <div className={`absolute top-3 -bottom-3 left-1/2 -translate-x-1/2 w-px ${lineState === 'end' || lineState === 'default' ? 'bg-[var(--border-subtle)]' : 'bg-[var(--accent)]'
                        }`}></div>
                )}

                {/* Icon (z-index to sit on top) */}
                <div className="relative z-10 w-5 h-5 flex items-center justify-center rounded-full bg-[var(--bg-primary)] group-hover:bg-[var(--bg-tertiary)] transition-colors">
                    {getEntrySymbol()}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {/* Main content - supports multi-line with whitespace-pre-wrap */}
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1.5">
                    {entry.content && (
                        <span className={`text-[15px] leading-relaxed break-words font-mono whitespace-pre-wrap ${isSessionStart ? 'text-[var(--text-primary)] font-bold' :
                            isSessionEnd ? 'text-[var(--text-muted)] italic' :
                                isTodo ? 'text-[var(--todo)]' :
                                    isTaskDone ? 'text-[var(--text-muted)] line-through decoration-[var(--done)]' :
                                        'text-[var(--text-secondary)]'
                            }`}>
                            {entry.content}
                        </span>
                    )}

                    {/* Inline badges */}
                    {isSessionStart && sessionDuration && (
                        <span className="text-[11px] text-[var(--accent)] bg-[var(--accent-subtle)] px-1.5 py-0.5 rounded-[3px] select-none font-medium">
                            {formatDuration(sessionDuration)}
                        </span>
                    )}

                    {isTaskDone && (
                        <span className="text-[11px] text-[var(--done)] font-bold select-none">[DONE]</span>
                    )}

                    {isTodo && (
                        <span className="text-[11px] text-[var(--todo)] font-bold select-none">[TODO]</span>
                    )}
                </div>

                {/* Category badge - below content */}
                {category && (
                    <div className="mt-1.5">
                        <span
                            className="text-[10px] px-2 py-0.5 rounded-[3px] font-bold uppercase select-none tracking-wide"
                            style={{
                                color: category.color,
                                backgroundColor: `${category.color}15`,
                                border: `1px solid ${category.color}30`
                            }}
                        >
                            {category.label}
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}
