import { describe, it, expect } from 'vitest'
import { computeDiff } from './syncDiff'

interface TestItem {
    id: string
    value: string
}

describe('computeDiff', () => {
    it('detects new items', () => {
        const prev: TestItem[] = []
        const current: TestItem[] = [{ id: '1', value: 'a' }]

        const result = computeDiff(prev, current)
        expect(result.changed).toEqual([{ id: '1', value: 'a' }])
        expect(result.deletedIds).toEqual([])
    })

    it('detects deleted items', () => {
        const item = { id: '1', value: 'a' }
        const prev: TestItem[] = [item]
        const current: TestItem[] = []

        const result = computeDiff(prev, current)
        expect(result.changed).toEqual([])
        expect(result.deletedIds).toEqual(['1'])
    })

    it('detects changed items by reference inequality', () => {
        const original = { id: '1', value: 'a' }
        const prev: TestItem[] = [original]
        // New object with same id but different reference
        const updated = { id: '1', value: 'b' }
        const current: TestItem[] = [updated]

        const result = computeDiff(prev, current)
        expect(result.changed).toEqual([updated])
        expect(result.deletedIds).toEqual([])
    })

    it('skips unchanged items (same reference)', () => {
        const item = { id: '1', value: 'a' }
        const prev: TestItem[] = [item]
        const current: TestItem[] = [item] // Same reference

        const result = computeDiff(prev, current)
        expect(result.changed).toEqual([])
        expect(result.deletedIds).toEqual([])
    })

    it('handles mixed changes', () => {
        const kept = { id: '1', value: 'kept' }
        const toDelete = { id: '2', value: 'delete-me' }
        const toUpdate = { id: '3', value: 'old' }
        const updated = { id: '3', value: 'new' }
        const brandNew = { id: '4', value: 'new-item' }

        const prev = [kept, toDelete, toUpdate]
        const current = [kept, updated, brandNew]

        const result = computeDiff(prev, current)
        expect(result.changed).toEqual([updated, brandNew])
        expect(result.deletedIds).toEqual(['2'])
    })

    it('respects deleteFilter predicate', () => {
        const builtIn = { id: 'note', value: 'built-in' }
        const custom = { id: 'custom-1', value: 'user-created' }
        const prev = [builtIn, custom]
        const current: TestItem[] = []

        // Filter excludes items with id 'note' from deletion
        const result = computeDiff(prev, current, (item) => item.id !== 'note')
        expect(result.deletedIds).toEqual(['custom-1'])
    })

    it('handles empty arrays', () => {
        const result = computeDiff<TestItem>([], [])
        expect(result.changed).toEqual([])
        expect(result.deletedIds).toEqual([])
    })
})
