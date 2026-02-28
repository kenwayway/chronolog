import { describe, it, expect } from 'vitest'
import { mergeEntries, mergeMediaItems, mergeMediaItemsFull } from './syncMerge'

interface TestItem {
    id: string
    value: string
}

function item(id: string, value: string): TestItem {
    return { id, value }
}

// ========================================
// mergeEntries
// ========================================
describe('mergeEntries', () => {
    it('keeps local-modified entries over remote', () => {
        const prev = [item('a', 'v1')]
        const local = [item('a', 'v2')] // modified (different ref)
        const remote = [item('a', 'v3')]

        const result = mergeEntries(local, remote, prev, [])
        expect(result).toHaveLength(1)
        expect(result[0].value).toBe('v2') // local wins
    })

    it('accepts remote when local is unchanged (same reference)', () => {
        const shared = item('a', 'v1')
        const prev = [shared]
        const local = [shared]  // same reference → untouched
        const remote = [item('a', 'v3')]

        const result = mergeEntries(local, remote, prev, [])
        expect(result).toHaveLength(1)
        expect(result[0].value).toBe('v3') // remote wins
    })

    it('appends new remote entries', () => {
        const local = [item('a', 'v1')]
        const remote = [item('b', 'v2')]

        const result = mergeEntries(local, remote, [], [])
        expect(result).toHaveLength(2)
        expect(result.map(r => r.id)).toEqual(['a', 'b'])
    })

    it('removes deleted entries', () => {
        const local = [item('a', 'v1'), item('b', 'v2')]

        const result = mergeEntries(local, [], [], ['a'])
        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('b')
    })

    it('handles combined scenario: delete + merge + append', () => {
        const shared = item('b', 'v1')
        const prev = [item('a', 'old'), shared]
        const local = [item('a', 'old'), shared, item('c', 'local')]
        const remote = [item('b', 'updated'), item('d', 'new')]

        const result = mergeEntries(local, remote, prev, ['a'])
        // 'a' deleted, 'b' unchanged so remote wins, 'c' local only, 'd' new remote
        expect(result.map(r => r.id)).toEqual(['b', 'c', 'd'])
        expect(result.find(r => r.id === 'b')!.value).toBe('updated')
    })
})

// ========================================
// mergeMediaItems
// ========================================
describe('mergeMediaItems', () => {
    it('keeps ALL local when hasUnsyncedChanges is true', () => {
        const local = [item('a', 'local')]
        const remote = [item('a', 'remote'), item('b', 'new')]

        const result = mergeMediaItems(local, remote, [], true)
        expect(result).toHaveLength(2)
        expect(result[0].value).toBe('local') // local preserved
        expect(result[1].id).toBe('b') // new remote appended
    })

    it('uses 3-way merge when no unsynced changes', () => {
        const shared = item('a', 'v1')
        const prev = [shared]
        const local = [shared] // same ref
        const remote = [item('a', 'v2')]

        const result = mergeMediaItems(local, remote, prev, false)
        expect(result[0].value).toBe('v2') // remote wins
    })
})

// ========================================
// mergeMediaItemsFull
// ========================================
describe('mergeMediaItemsFull', () => {
    it('keeps all local and appends new remote', () => {
        const local = [item('a', 'local')]
        const remote = [item('a', 'remote'), item('b', 'new')]

        const result = mergeMediaItemsFull(local, remote)
        expect(result).toHaveLength(2)
        expect(result[0].value).toBe('local') // local always wins
        expect(result[1].id).toBe('b')
    })

    it('returns only local when remote has nothing new', () => {
        const local = [item('a', 'v1')]
        const remote = [item('a', 'v2')]

        const result = mergeMediaItemsFull(local, remote)
        expect(result).toHaveLength(1)
        expect(result[0].value).toBe('v1')
    })
})
