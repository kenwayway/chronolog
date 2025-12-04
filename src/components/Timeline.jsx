import { useState } from 'react'
import { ENTRY_TYPES } from '../utils/constants'
import { formatTime, formatDuration, formatDate } from '../utils/formatters'

export function Timeline({ entries, status, categories, onContextMenu }) {
    // Sort entries chronologically (oldest first, top to bottom)
    const sortedEntries = [...entries].sort((a, b) => a.timestamp - b.timestamp)

    // Build a map of SESSION_START -> duration (from matching SESSION_END)
    const sessionDurations = {}
    let currentSessionStartId = null

    for (const entry of sortedEntries) {
        if (entry.type === ENTRY_TYPES.SESSION_START) {
            currentSessionStartId = entry.id
        } else if (entry.type === ENTRY_TYPES.SESSION_END && currentSessionStartId) {
            sessionDurations[currentSessionStartId] = entry.duration
            currentSessionStartId = null
        }
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
                    <div className="flex items-center gap-4 mb-4 text-xs text-[var(--text-muted)] select-none">
                        <span className="text-[var(--text-dim)]">#</span>
                        <span className="uppercase tracking-wider font-bold">
                            {isToday(dateKey) ? 'TODAY' : formatDate(new Date(dateKey).getTime())}
                        </span>
                        <div className="flex-1 h-px bg-[var(--border-subtle)]"></div>
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
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

function TimelineEntry({ entry, isFirst, isLast, sessionDuration, categories, onContextMenu }) {
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
                return <span className="text-[var(--streaming)] font-bold">»</span>
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
            className={`group flex items-start gap-3 py-2 px-2 -mx-2 rounded-[2px] hover:bg-[var(--bg-tertiary)] transition-colors duration-75 cursor-default select-text ${isTaskDone ? 'opacity-70' : ''}`}
            onContextMenu={handleContextMenu}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
        >
            {/* Timestamp (Line Number Style) */}
            <div className="flex-shrink-0 w-12 text-xs text-[var(--text-dim)] text-right pt-0.5 font-mono opacity-50 group-hover:opacity-100 transition-opacity">
                {formatTime(entry.timestamp)}
            </div>

            {/* Symbol */}
            <div className="flex-shrink-0 w-4 text-center pt-0.5 text-xs select-none">
                {getEntrySymbol()}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {/* Main content - supports multi-line with whitespace-pre-wrap */}
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                    {entry.content && (
                        <span className={`text-sm leading-relaxed break-words font-mono whitespace-pre-wrap ${isSessionStart ? 'text-[var(--text-primary)] font-bold' :
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
                        <span className="text-[10px] text-[var(--accent)] bg-[var(--accent-subtle)] px-1 rounded-[2px] select-none">
                            {formatDuration(sessionDuration)}
                        </span>
                    )}

                    {isTaskDone && (
                        <span className="text-[10px] text-[var(--done)] font-bold select-none">[DONE]</span>
                    )}

                    {isTodo && (
                        <span className="text-[10px] text-[var(--todo)] font-bold select-none">[TODO]</span>
                    )}
                </div>

                {/* Category badge - below content */}
                {category && (
                    <div className="mt-1">
                        <span
                            className="text-[10px] px-1.5 py-0.5 rounded-[2px] font-bold uppercase select-none"
                            style={{
                                color: category.color,
                                backgroundColor: `${category.color}20`,
                                border: `1px solid ${category.color}40`
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
