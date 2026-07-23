import { describe, expect, it } from 'vitest'
import { migrateBoundaryRecords } from './fromEntryBoundaries'

describe('boundary record browser migration', () => {
    it('folds boundaries, remaps links, and preserves orphan ends as notes', () => {
        const result = migrateBoundaryRecords([
            {
                id: 'start',
                type: 'SESSION_START',
                content: 'work',
                timestamp: 100,
                sessionId: 'session',
                linkedEntries: ['note'],
            },
            {
                id: 'note',
                type: 'NOTE',
                content: 'detail',
                timestamp: 150,
                sessionId: 'session',
                linkedEntries: ['start', 'end'],
            },
            {
                id: 'end',
                type: 'SESSION_END',
                content: 'done',
                timestamp: 200,
                sessionId: 'session',
                linkedEntries: ['note'],
            },
            {
                id: 'orphan',
                type: 'SESSION_END',
                content: 'keep me',
                timestamp: 300,
                sessionId: 'missing',
            },
        ])

        expect(result.sessions).toEqual([
            expect.objectContaining({
                id: 'session',
                startAt: 100,
                endAt: 200,
                endContent: 'done',
                linkedItems: ['note'],
            }),
        ])
        expect(result.notes).toEqual([
            expect.objectContaining({
                id: 'note',
                sessionId: 'session',
                linkedItems: ['session'],
            }),
            expect.objectContaining({
                id: 'orphan',
                content: 'keep me',
                sessionId: undefined,
            }),
        ])
    })
})
