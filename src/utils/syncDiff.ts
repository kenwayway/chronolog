/**
 * Generic diff utility for sync operations.
 * Compares previous and current arrays of items by `id` using reference equality.
 */
export interface DiffResult<T> {
    changed: T[]
    deletedIds: string[]
}

/**
 * Compute the diff between two arrays of identifiable items.
 * Uses reference equality (===) to detect changes — works with immutable state.
 *
 * @param prev - Previous snapshot of items
 * @param current - Current items
 * @param deleteFilter - Optional predicate to exclude certain prev items from deletion detection
 *                       (e.g. skip built-in content types)
 */
export function computeDiff<T extends { id: string }>(
    prev: T[],
    current: T[],
    deleteFilter?: (item: T) => boolean,
): DiffResult<T> {
    const prevMap = new Map(prev.map(item => [item.id, item]))

    const changed: T[] = []
    for (const item of current) {
        const prevItem = prevMap.get(item.id)
        if (!prevItem || prevItem !== item) changed.push(item)
    }

    const currentIds = new Set(current.map(item => item.id))
    const deletedIds = prev
        .filter(item => !currentIds.has(item.id) && (!deleteFilter || deleteFilter(item)))
        .map(item => item.id)

    return { changed, deletedIds }
}
