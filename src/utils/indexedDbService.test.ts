import { describe, expect, it } from 'vitest'
import { createPersistenceQueue, getEntityChanges } from './indexedDbService'

interface TestEntity {
    id: string
    value: number
}

describe('getEntityChanges', () => {
    it('only upserts new objects and preserves unchanged references', () => {
        const unchanged: TestEntity = { id: 'same', value: 1 }
        const oldChanged: TestEntity = { id: 'changed', value: 1 }
        const newChanged: TestEntity = { id: 'changed', value: 2 }
        const added: TestEntity = { id: 'added', value: 3 }

        const changes = getEntityChanges(
            [unchanged, oldChanged],
            [unchanged, newChanged, added],
        )

        expect(changes.upserts).toEqual([newChanged, added])
        expect(changes.deletedIds).toEqual([])
    })

    it('returns IDs removed from the current state', () => {
        const kept: TestEntity = { id: 'kept', value: 1 }
        const removed: TestEntity = { id: 'removed', value: 2 }

        const changes = getEntityChanges([kept, removed], [kept])

        expect(changes.upserts).toEqual([])
        expect(changes.deletedIds).toEqual(['removed'])
    })
})

describe('createPersistenceQueue', () => {
    it('advances the baseline only after a successful write', async () => {
        const writes: Array<{ current: string; previous: string | null }> = []
        const queue = createPersistenceQueue<string>(async (current, previous) => {
            writes.push({ current, previous })
        })
        queue.seed('hydrated')

        await queue.enqueue('first')
        await queue.enqueue('second')

        expect(writes).toEqual([
            { current: 'first', previous: 'hydrated' },
            { current: 'second', previous: 'first' },
        ])
    })

    it('forces the next already-queued write to use a full baseline after failure', async () => {
        const writes: Array<{ current: string; previous: string | null }> = []
        let shouldFail = true
        const queue = createPersistenceQueue<string>(async (current, previous) => {
            writes.push({ current, previous })
            if (shouldFail) {
                shouldFail = false
                throw new Error('quota exceeded')
            }
        })
        queue.seed('hydrated')

        const failedWrite = queue.enqueue('first')
        const recoveryWrite = queue.enqueue('second')

        await expect(failedWrite).rejects.toThrow('quota exceeded')
        await expect(recoveryWrite).resolves.toBeUndefined()
        expect(writes).toEqual([
            { current: 'first', previous: 'hydrated' },
            { current: 'second', previous: null },
        ])
    })
})
