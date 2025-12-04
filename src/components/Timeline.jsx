import { useState } from 'react'
import { ENTRY_TYPES } from '../utils/constants'
import { formatTime, formatDuration, formatDate } from '../utils/formatters'

export function Timeline({ entries, status, onContextMenu }) {
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
        <div className="flex-1 overflow-y-auto p-6 pb-30">
            {entries.length === 0 && (
                <div className="flex flex-col items-center justify-center h-75 text-[var(--text-muted)] text-center">
                    <div className="text-5xl mb-4 opacity-50">◇</div>
                    <p>No entries yet</p>
                    <p className="text-sm text-[var(--text-dim)] mt-1">Type something and press LOG IN to start</p>
                </div>
            )}

            {dateGroups.map(dateKey => (
                <div key={dateKey} className="mb-8">
                    <div className="mb-4 pb-2 border-b border-[var(--border-subtle)]">
                        <span className="text-sm font-500 text-[var(--text-secondary)] tracking-wide">
                            {isToday(dateKey) ? 'Today' : formatDate(new Date(dateKey).getTime())}
                        </span>
                    </div>

                    <div className="relative">
                        {groupedEntries[dateKey].map((entry, index) => (
                            <TimelineEntry
                                key={entry.id}
                                entry={entry}
                                isFirst={index === 0}
                                isLast={index === groupedEntries[dateKey].length - 1}
                                sessionDuration={sessionDurations[entry.id]}
                                onContextMenu={onContextMenu}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

function TimelineEntry({ entry, isFirst, isLast, sessionDuration, onContextMenu }) {
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

    const getEntryIcon = () => {
        switch (entry.type) {
            case ENTRY_TYPES.SESSION_START:
                return <span className="relative z-1 text-base leading-none bg-[var(--icon-bg)] p-0.5 text-[var(--streaming)]">●</span>
            case ENTRY_TYPES.SESSION_END:
                return <span className="relative z-1 text-base leading-none bg-[var(--icon-bg)] p-0.5 text-[var(--accent)]">●</span>
            case ENTRY_TYPES.NOTE:
                return <span className="relative z-1 text-sm leading-none bg-[var(--icon-bg)] p-0.5 text-[var(--text-muted)]">{entry.isTodo ? '○' : '·'}</span>
            case ENTRY_TYPES.TASK_DONE:
                return <span className="relative z-1 text-sm leading-none bg-[var(--icon-bg)] p-0.5 text-[var(--done)] font-bold">✓</span>
            default:
                return <span className="relative z-1 text-sm leading-none bg-[var(--icon-bg)] p-0.5">·</span>
        }
    }

    const baseClass = "flex items-start gap-4 py-2 transition-colors duration-150 cursor-default select-none animate-slide-in"
    const hoverClass = "hover:bg-[var(--bg-glass-light)] hover:rounded-lg"
    const todoClass = entry.isTodo ? 'text-[var(--todo)]' : ''
    const taskDoneClass = entry.type === ENTRY_TYPES.TASK_DONE ? 'bg-[var(--accent-subtle)] rounded-lg p-2!' : ''

    return (
        <div
            className={`${baseClass} ${hoverClass} ${taskDoneClass}`}
            onContextMenu={handleContextMenu}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
        >
            {/* Timestamp on left */}
            <div className="flex-shrink-0 w-12 text-xs text-[var(--text-muted)] text-right pt-0.5 font-mono">{formatTime(entry.timestamp)}</div>

            {/* Timeline track */}
            <div className="relative flex items-start justify-center w-6 flex-shrink-0 pt-1">
                <div className={`absolute left-1/2 -translate-x-1/2 w-0.5 bg-[var(--border-light)] ${isFirst ? 'top-1/2' : 'top-0'} ${isLast ? 'bottom-1/2' : '-bottom-4'}`}></div>
                {getEntryIcon()}
            </div>

            {/* Content on right */}
            <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    {entry.content && (
                        <p className={`flex-1 min-w-0 text-base text-[var(--text-primary)] leading-relaxed break-words ${entry.type === ENTRY_TYPES.SESSION_START ? 'font-500' : ''} ${entry.type === ENTRY_TYPES.SESSION_END ? 'text-[var(--text-secondary)]' : ''} ${todoClass}`}>
                            {entry.content}
                        </p>
                    )}

                    {/* Duration badge on SESSION_START */}
                    {entry.type === ENTRY_TYPES.SESSION_START && sessionDuration && (
                        <div className="badge-accent rounded-full font-mono">
                            {formatDuration(sessionDuration)}
                        </div>
                    )}

                    {entry.type === ENTRY_TYPES.TASK_DONE && (
                        <div className="badge-done">DONE</div>
                    )}

                    {entry.isTodo && (
                        <div className="badge-todo">TODO</div>
                    )}
                </div>
            </div>
        </div>
    )
}
