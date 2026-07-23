import { describe, expect, it } from 'vitest'
import { buildSyncMutations, dirtyIdsByType, mutationKey } from './syncOutbox'

describe('sync outbox', () => {
    it('coalesces repeated entity edits under a stable key', () => {
        const previous = [{ id: 'a', value: 1 }]
        const mutations = buildSyncMutations(previous, [{ id: 'a', value: 2 }], 'entry')
        expect(mutations).toHaveLength(1)
        expect(mutations[0]).toMatchObject({
            key: mutationKey('entry', 'a'),
            entityId: 'a',
            operation: 'upsert',
            value: { id: 'a', value: 2 },
        })
    })

    it('does not emit mutations for structurally equal projected entries', () => {
        const previous = [{ id: 'a', nested: { value: 1 } }]
        const current = [{ id: 'a', nested: { value: 1 } }]
        expect(buildSyncMutations(previous, current, 'entry')).toEqual([])
    })

    it('emits deletes and groups dirty IDs by entity type', () => {
        const mutations = buildSyncMutations([{ id: 'gone' }], [], 'mediaItem')
        expect(mutations[0].operation).toBe('delete')
        expect(dirtyIdsByType(mutations).mediaItem.has('gone')).toBe(true)
    })
})
