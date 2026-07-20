/**
 * Session pairing: match SESSION_START / SESSION_END entries into sessions.
 *
 * Pairing is sessionId-first with a chronological fallback:
 * - An END carrying a sessionId only pairs with the open START of that same
 *   sessionId. This keeps pairs stable when timestamps are edited and when
 *   sessions from two devices interleave after a sync merge.
 * - A legacy END without a sessionId pairs with the most recently opened START.
 * - An END that matches nothing is dropped; a START never closed stays open
 *   (end: null), which callers may treat as a live session.
 *
 * Durations are always computed from timestamps — the stored `duration` field
 * on SESSION_END goes stale when timestamps are edited and is never used here.
 */

import { ENTRY_TYPES } from '@/utils/constants'

interface SessionBoundaryLike {
    id: string
    type: string
    timestamp: number
    sessionId?: string
}

export interface PairedSession<T extends SessionBoundaryLike> {
    start: T
    /** null = session still open */
    end: T | null
    /** null while the session is open */
    durationMs: number | null
}

/**
 * Pair sessions from a list of entries (non-boundary types are ignored).
 * Input order does not matter — entries are sorted by timestamp internally.
 * Returned sessions are ordered by start timestamp.
 */
export function pairSessions<T extends SessionBoundaryLike>(entries: T[]): PairedSession<T>[] {
    const boundaries = entries
        .filter(e => e.type === ENTRY_TYPES.SESSION_START || e.type === ENTRY_TYPES.SESSION_END)
        .sort((a, b) => a.timestamp - b.timestamp)

    const sessions: PairedSession<T>[] = []
    const open: PairedSession<T>[] = []

    for (const entry of boundaries) {
        if (entry.type === ENTRY_TYPES.SESSION_START) {
            const session: PairedSession<T> = { start: entry, end: null, durationMs: null }
            sessions.push(session)
            open.push(session)
            continue
        }

        // SESSION_END: find its START among the open sessions
        let index = -1
        if (entry.sessionId) {
            for (let i = open.length - 1; i >= 0; i--) {
                if (open[i].start.sessionId === entry.sessionId) { index = i; break }
            }
        } else {
            // Legacy END without sessionId → most recently opened session
            index = open.length - 1
        }
        if (index === -1) continue // unmatched END — dropped

        const session = open[index]
        session.end = entry
        session.durationMs = entry.timestamp - session.start.timestamp
        open.splice(index, 1)
    }

    return sessions
}

/** Convenience: durations keyed by the START entry's id (closed sessions only). */
export function sessionDurationsByStartId<T extends SessionBoundaryLike>(entries: T[]): Record<string, number> {
    const durations: Record<string, number> = {}
    for (const session of pairSessions(entries)) {
        if (session.durationMs !== null) durations[session.start.id] = session.durationMs
    }
    return durations
}
