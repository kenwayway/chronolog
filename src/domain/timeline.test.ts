import { describe, expect, it } from 'vitest'
import type { Note, Session } from '@/types'
import {
    buildTimelineLinkIndex,
    projectTimelineItems,
    timelineItemForEntity,
} from './timeline'

function note(id: string, timestamp: number, overrides: Partial<Note> = {}): Note {
    return { id, content: `note ${id}`, timestamp, ...overrides }
}

function session(id: string, startAt: number, endAt: number | null, overrides: Partial<Session> = {}): Session {
    return { id, content: `session ${id}`, startAt, endAt, ...overrides }
}

describe('projectTimelineItems', () => {
    it('projects notes and session boundaries sorted by timestamp', () => {
        const items = projectTimelineItems(
            [note('n1', 150)],
            [session('s1', 100, 200)],
        )
        expect(items.map(item => item.id)).toEqual([
            'session:s1:start',
            'n1',
            'session:s1:end',
        ])
        expect(items[0]).toMatchObject({ entityId: 's1', kind: 'session-start', timestamp: 100 })
        expect(items[2]).toMatchObject({ entityId: 's1', kind: 'session-end', timestamp: 200 })
    })

    it('omits the end marker for an open session', () => {
        const items = projectTimelineItems([], [session('s1', 100, null)])
        expect(items).toHaveLength(1)
        expect(items[0].kind).toBe('session-start')
    })

    it('resolves an entity to its canonical view, never a session end', () => {
        const items = projectTimelineItems([], [session('s1', 100, 200)])
        expect(timelineItemForEntity(items, 's1')?.kind).toBe('session-start')
    })

    it('projects zaddy origin onto both session boundaries', () => {
        const items = projectTimelineItems([], [session('s1', 100, 200, { origin: 'zaddy' })])
        expect(items.map(item => item.origin)).toEqual(['zaddy', 'zaddy'])
    })
})

describe('buildTimelineLinkIndex', () => {
    it('indexes canonical items and incoming links', () => {
        const items = projectTimelineItems(
            [note('n1', 150, { linkedItems: ['s1'] }), note('n2', 160)],
            [session('s1', 100, 200)],
        )
        const index = buildTimelineLinkIndex(items)

        expect(index.byEntityId.get('s1')?.kind).toBe('session-start')
        expect(index.byEntityId.get('n1')?.id).toBe('n1')
        // n1 links to s1, so s1 has one incoming link from n1.
        expect(index.incoming.get('s1')).toEqual(['n1'])
        expect(index.incoming.get('n2')).toBeUndefined()
    })

    it('deduplicates incoming links from both session boundary views', () => {
        // A session projects two timeline items sharing linkedItems; the
        // reverse index must still record the session only once.
        const items = projectTimelineItems(
            [note('n1', 150)],
            [session('s1', 100, 200, { linkedItems: ['n1'] })],
        )
        const index = buildTimelineLinkIndex(items)
        expect(index.incoming.get('n1')).toEqual(['s1'])
    })

    it('ignores self links', () => {
        const items = projectTimelineItems([note('n1', 100, { linkedItems: ['n1'] })], [])
        expect(buildTimelineLinkIndex(items).incoming.get('n1')).toBeUndefined()
    })
})
