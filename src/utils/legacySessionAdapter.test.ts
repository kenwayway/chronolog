import { describe, expect, it } from 'vitest'
import type { Entry, Session } from '@/types'
import { importLegacySessions, projectSessionsToEntries } from './legacySessionAdapter'

function entry(overrides: Partial<Entry>): Entry {
    return { id: 'entry', type: 'NOTE', content: '', timestamp: 0, ...overrides }
}

describe('legacySessionAdapter', () => {
    it('imports paired boundaries into one interval and keeps only notes as entries', () => {
        const source = [
            entry({ id: 'start', type: 'SESSION_START', content: 'work', timestamp: 1000, sessionId: 'session-1', category: 'craft' }),
            entry({ id: 'note', type: 'NOTE', content: 'progress', timestamp: 1500, sessionId: 'session-1' }),
            entry({ id: 'end', type: 'SESSION_END', content: 'done', timestamp: 2500, sessionId: 'session-1' }),
        ]

        const result = importLegacySessions(source)

        expect(result.entries.map(item => item.id)).toEqual(['note'])
        expect(result.sessions).toEqual([expect.objectContaining({
            id: 'session-1',
            startEntryId: 'start',
            endEntryId: 'end',
            content: 'work',
            endContent: 'done',
            startAt: 1000,
            endAt: 2500,
            category: 'craft',
        })])
        expect(result.activeSessionId).toBeNull()
    })

    it('selects only the most recently started open interval as active', () => {
        const source = [
            entry({ id: 'old', type: 'SESSION_START', timestamp: 1000, sessionId: 'old-session' }),
            entry({ id: 'new', type: 'SESSION_START', timestamp: 2000, sessionId: 'new-session' }),
        ]

        expect(importLegacySessions(source).activeSessionId).toBe('new-session')
    })

    it('projects canonical sessions to stable legacy boundary IDs', () => {
        const session: Session = {
            id: 'session-1',
            startEntryId: 'start',
            endEntryId: 'end',
            content: 'work',
            startAt: 1000,
            endAt: 2000,
            endContent: 'done',
        }

        const projected = projectSessionsToEntries([], [session])
        expect(projected.map(item => [item.id, item.type, item.sessionId])).toEqual([
            ['start', 'SESSION_START', 'session-1'],
            ['end', 'SESSION_END', 'session-1'],
        ])
    })
})
