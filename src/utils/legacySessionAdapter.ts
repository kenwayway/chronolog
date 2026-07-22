import type { Entry, Session } from '@/types'
import { generateId } from '@/utils/formatters'
import { pairSessions } from '@/utils/sessionPairing'

/**
 * Convert legacy boundary entries into the canonical interval model.
 * This is the only runtime path that pairs START/END records, and it runs only
 * when old persisted or remote data enters the application.
 */
export function importLegacySessions(
    sourceEntries: Entry[],
    canonicalSessions: Session[] = [],
): { entries: Entry[]; sessions: Session[]; activeSessionId: string | null } {
    const entries = sourceEntries.filter(entry => entry.type === 'NOTE')
    const boundaries = sourceEntries.filter(entry => entry.type !== 'NOTE')
    const existingIds = new Set(canonicalSessions.map(session => session.id))
    const sessions = [...canonicalSessions]

    for (const pair of pairSessions(boundaries)) {
        const start = pair.start
        const end = pair.end
        const id = start.sessionId || generateId()
        if (existingIds.has(id)) continue

        sessions.push({
            id,
            startEntryId: start.id,
            endEntryId: end?.id,
            content: start.content,
            startAt: start.timestamp,
            endAt: end?.timestamp ?? null,
            endContent: end?.content || undefined,
            category: start.category,
            contentType: start.contentType,
            fieldValues: start.fieldValues,
            tags: start.tags,
            endTags: end?.tags,
            linkedEntries: start.linkedEntries,
            endLinkedEntries: end?.linkedEntries,
        })
        existingIds.add(id)
    }

    sessions.sort((a, b) => a.startAt - b.startAt)
    const open = sessions.filter(session => session.endAt === null)
    const activeSessionId = open.length > 0 ? open[open.length - 1].id : null

    return { entries, sessions, activeSessionId }
}

/** Project canonical sessions into the old entry-shaped wire/view format. */
export function projectSessionsToEntries(entries: Entry[], sessions: Session[]): Entry[] {
    const projected: Entry[] = [...entries]

    for (const session of sessions) {
        projected.push({
            id: session.startEntryId,
            type: 'SESSION_START',
            content: session.content,
            timestamp: session.startAt,
            sessionId: session.id,
            category: session.category,
            contentType: session.contentType,
            fieldValues: session.fieldValues,
            tags: session.tags,
            linkedEntries: session.linkedEntries,
        })

        if (session.endAt !== null && session.endEntryId) {
            projected.push({
                id: session.endEntryId,
                type: 'SESSION_END',
                content: session.endContent || '',
                timestamp: session.endAt,
                sessionId: session.id,
                tags: session.endTags,
                linkedEntries: session.endLinkedEntries,
            })
        }
    }

    return projected.sort((a, b) => a.timestamp - b.timestamp)
}

export function sessionForBoundary(
    sessions: Session[],
    entryId: string,
): { session: Session; boundary: 'start' | 'end' } | null {
    for (const session of sessions) {
        if (session.startEntryId === entryId) return { session, boundary: 'start' }
        if (session.endEntryId === entryId) return { session, boundary: 'end' }
    }
    return null
}
