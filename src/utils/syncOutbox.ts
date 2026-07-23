import type { SyncEntity, SyncEntityType, SyncMutation } from '@/types'
import { generateId } from './formatters'

interface Identifiable {
    id: string
}

function newMutationId(): string {
    return globalThis.crypto?.randomUUID?.() ?? generateId()
}

export function mutationKey(entityType: SyncEntityType, entityId: string): string {
    return `${entityType}:${entityId}`
}

function sameValue(left: unknown, right: unknown): boolean {
    if (left === right) return true
    return JSON.stringify(left) === JSON.stringify(right)
}

/** Turn one state transition into coalescible durable mutations. */
export function buildSyncMutations<T extends Identifiable>(
    previous: T[],
    current: T[],
    entityType: SyncEntityType,
): SyncMutation[] {
    const previousById = new Map(previous.map(item => [item.id, item]))
    const currentIds = new Set(current.map(item => item.id))
    const now = Date.now()

    const changed = current.filter(item => {
        const previousItem = previousById.get(item.id)
        return !previousItem || !sameValue(previousItem, item)
    })
    const deletedIds = previous.filter(item => !currentIds.has(item.id)).map(item => item.id)

    return [
        ...changed.map(value => ({
            key: mutationKey(entityType, value.id),
            mutationId: newMutationId(),
            entityType,
            entityId: value.id,
            operation: 'upsert' as const,
            value: value as unknown as SyncEntity,
            createdAt: now,
        })),
        ...deletedIds.map(entityId => ({
            key: mutationKey(entityType, entityId),
            mutationId: newMutationId(),
            entityType,
            entityId,
            operation: 'delete' as const,
            createdAt: now,
        })),
    ]
}

export function dirtyIdsByType(mutations: SyncMutation[]): Record<SyncEntityType, Set<string>> {
    const result: Record<SyncEntityType, Set<string>> = {
        entry: new Set(),
        contentType: new Set(),
        mediaItem: new Set(),
    }
    mutations.forEach(mutation => result[mutation.entityType].add(mutation.entityId))
    return result
}
