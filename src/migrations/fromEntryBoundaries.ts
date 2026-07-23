import type { Note, Session } from '@/types'

export interface BoundaryRecord {
    id: string
    type: 'SESSION_START' | 'NOTE' | 'SESSION_END'
    content: string
    timestamp: number
    sessionId?: string
    duration?: number
    category?: Note['category']
    contentType?: string
    fieldValues?: Note['fieldValues']
    linkedEntries?: string[]
    tags?: string[]
}

export type BoundarySessionRecord = Session & {
    startEntryId?: string
    endEntryId?: string
    linkedEntries?: string[]
    endLinkedEntries?: string[]
}

function deriveSessions(records: BoundaryRecord[]): BoundarySessionRecord[] {
    return records
        .filter(record => record.type === 'SESSION_START')
        .sort((left, right) => left.timestamp - right.timestamp)
        .map(start => {
            const id = start.sessionId || start.id
            const end = records
                .filter(record =>
                    record.type === 'SESSION_END'
                    && record.sessionId === id
                    && record.timestamp >= start.timestamp
                )
                .sort((left, right) => left.timestamp - right.timestamp)[0]
            return {
                id,
                content: start.content,
                startAt: start.timestamp,
                endAt: end?.timestamp ?? null,
                endContent: end?.content || undefined,
                category: start.category,
                contentType: start.contentType,
                fieldValues: start.fieldValues,
                tags: start.tags,
                endTags: end?.tags,
                startEntryId: start.id,
                endEntryId: end?.id,
                linkedEntries: start.linkedEntries,
                endLinkedEntries: end?.linkedEntries,
            }
        })
}

/** One-way conversion used only while upgrading browser persistence. */
export function migrateBoundaryRecords(
    records: BoundaryRecord[],
    storedSessions: BoundarySessionRecord[] = [],
): { notes: Note[]; sessions: Session[] } {
    const sourceSessions = storedSessions.length > 0 ? storedSessions : deriveSessions(records)
    const sessionIds = new Set(sourceSessions.map(session => session.id))
    const boundaryIds = new Map<string, string>()
    sourceSessions.forEach(session => {
        if (session.startEntryId) boundaryIds.set(session.startEntryId, session.id)
        if (session.endEntryId) boundaryIds.set(session.endEntryId, session.id)
    })
    const mapLinks = (links?: string[]): string[] | undefined => {
        if (!links?.length) return undefined
        const mapped = [...new Set(links.map(id => boundaryIds.get(id) ?? id))]
        return mapped.length ? mapped : undefined
    }

    const sessions: Session[] = sourceSessions.map(({
        startEntryId: _startEntryId,
        endEntryId: _endEntryId,
        linkedEntries,
        endLinkedEntries,
        ...session
    }) => ({
        ...session,
        linkedItems: mapLinks([...(linkedEntries ?? []), ...(endLinkedEntries ?? [])]),
    }))

    const notes: Note[] = records
        .filter(record =>
            record.type === 'NOTE'
            || (
                record.type === 'SESSION_END'
                && !sourceSessions.some(session =>
                    session.endEntryId === record.id || session.id === record.sessionId
                )
            )
        )
        .map(({ type: _type, duration: _duration, linkedEntries, ...record }) => ({
            ...record,
            sessionId: record.sessionId && sessionIds.has(record.sessionId)
                ? record.sessionId
                : undefined,
            linkedItems: mapLinks(linkedEntries),
        }))

    return { notes, sessions }
}
