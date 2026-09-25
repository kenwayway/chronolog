import { describe, it, expect } from 'vitest'
import { findLinkedEntries, getMonthKey, getMonthLabel, groupByMonth, groupByType } from './mediaHelpers'
import type { MediaItem, MediaType } from '@/types'

function item(id: string, over: Partial<MediaItem> = {}): MediaItem {
    return { id, title: id, mediaType: 'Movie' as MediaType, createdAt: 0, ...over }
}

describe('getMonthKey', () => {
    it('slices dateFinished to a YYYY-MM bucket', () => {
        expect(getMonthKey(item('a', { dateFinished: '2026-09-17' }))).toBe('2026-09')
    })

    it('keeps the local month for the first of the month', () => {
        // new Date('2026-09-01') is UTC midnight — parsing would bucket this
        // into August for anyone west of Greenwich
        expect(getMonthKey(item('a', { dateFinished: '2026-09-01' }))).toBe('2026-09')
    })

    it('buckets missing or malformed dates as undated', () => {
        expect(getMonthKey(item('a'))).toBe('__undated')
        expect(getMonthKey(item('b', { dateFinished: '' }))).toBe('__undated')
        expect(getMonthKey(item('c', { dateFinished: 'someday' }))).toBe('__undated')
    })
})

describe('getMonthLabel', () => {
    it('renders month and year', () => {
        expect(getMonthLabel('2026-09')).toBe('SEPTEMBER 2026')
        expect(getMonthLabel('2025-01')).toBe('JANUARY 2025')
    })

    it('labels the undated bucket', () => {
        expect(getMonthLabel('__undated')).toBe('NO FINISH DATE')
    })

    it('falls back to the raw key for an out-of-range month', () => {
        expect(getMonthLabel('2026-13')).toBe('2026-13')
    })
})

describe('groupByMonth', () => {
    it('orders months newest first with undated trailing', () => {
        const sections = groupByMonth([
            item('old', { dateFinished: '2025-12-02' }),
            item('none'),
            item('new', { dateFinished: '2026-09-05' }),
        ])
        expect(sections.map(s => s.key)).toEqual(['2026-09', '2025-12', '__undated'])
    })

    it('sorts within a month by dateFinished, then by createdAt', () => {
        const sections = groupByMonth([
            item('early', { dateFinished: '2026-09-01' }),
            item('tieOld', { dateFinished: '2026-09-20', createdAt: 1 }),
            item('tieNew', { dateFinished: '2026-09-20', createdAt: 2 }),
        ])
        expect(sections[0].items.map(i => i.id)).toEqual(['tieNew', 'tieOld', 'early'])
    })

    it('returns no sections for an empty library', () => {
        expect(groupByMonth([])).toEqual([])
    })
})

describe('groupByType', () => {
    it('skips empty types and keeps MEDIA_TYPES order', () => {
        const sections = groupByType([
            item('g', { mediaType: 'Game' }),
            item('b', { mediaType: 'Book' }),
        ])
        expect(sections.map(s => s.key)).toEqual(['Book', 'Game'])
        expect(sections.map(s => s.label)).toEqual(['BOOKS', 'GAMES'])
    })

    it('sorts newest-added first within a type', () => {
        const sections = groupByType([
            item('older', { createdAt: 1 }),
            item('newer', { createdAt: 5 }),
        ])
        expect(sections[0].items.map(i => i.id)).toEqual(['newer', 'older'])
    })
})

describe('findLinkedEntries', () => {
    function entry(id: string, timestamp: number, fieldValues?: Record<string, unknown>) {
        return { id, entityId: id, kind: 'note' as const, content: id, timestamp, fieldValues }
    }

    it('matches entries by fieldValues.mediaId, newest first', () => {
        const linked = findLinkedEntries([
            entry('older', 100, { mediaId: 'm1' }),
            entry('other', 200, { mediaId: 'm2' }),
            entry('newer', 300, { mediaId: 'm1' }),
        ], 'm1')
        expect(linked.map(l => l.entry.id)).toEqual(['newer', 'older'])
    })

    it('ignores entries with no fieldValues or no mediaId', () => {
        expect(findLinkedEntries([
            entry('plain', 100),
            entry('otherField', 200, { url: 'm1' }),
        ], 'm1')).toEqual([])
    })

    it('returns nothing for an empty mediaId rather than matching undefined', () => {
        expect(findLinkedEntries([entry('a', 100, { mediaId: undefined })], '')).toEqual([])
    })

    it('pairs a linked session start with its non-empty end', () => {
        const start = { id: 'session:s1:start', entityId: 's1', kind: 'session-start' as const, content: 'Started', timestamp: 100, fieldValues: { mediaId: 'm1' } }
        const end = { id: 'session:s1:end', entityId: 's1', kind: 'session-end' as const, content: 'Loved the ending', timestamp: 200 }
        const blankEnd = { id: 'session:s2:end', entityId: 's2', kind: 'session-end' as const, content: '  ', timestamp: 400 }
        const blankStart = { ...start, id: 'session:s2:start', entityId: 's2', timestamp: 300 }
        const linked = findLinkedEntries([start, end, blankStart, blankEnd], 'm1')
        expect(linked.map(l => [l.entry.id, l.end?.id])).toEqual([
            ['session:s2:start', undefined],
            ['session:s1:start', 'session:s1:end'],
        ])
    })
})
