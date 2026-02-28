/**
 * Pure merge functions for cloud sync.
 * Extracted from useCloudSync for testability and separation of concerns.
 *
 * All functions are stateless — they take snapshots and return merged results.
 */

interface Identifiable {
    id: string
}

/**
 * 3-way merge for entries during incremental sync.
 *
 * Strategy:
 * - Remove entries that were deleted on remote
 * - For entries that exist both locally and remotely:
 *   - If local was modified since last snapshot → keep local
 *   - If local is unchanged → accept remote version
 * - Append new remote entries that don't exist locally
 */
export function mergeEntries<T extends Identifiable>(
    local: T[],
    remote: T[],
    prev: T[],
    deletedIds: string[],
): T[] {
    // Remove deleted entries
    const deletedSet = new Set(deletedIds)
    const filtered = deletedSet.size > 0
        ? local.filter(e => !deletedSet.has(e.id))
        : [...local]

    // Build lookup maps
    const remoteMap = new Map(remote.map(e => [e.id, e]))
    const prevMap = new Map(prev.map(e => [e.id, e]))

    // Merge existing: local-modified wins, otherwise accept remote
    const merged = filtered.map(e => {
        const remoteItem = remoteMap.get(e.id)
        if (!remoteItem) return e
        const prevItem = prevMap.get(e.id)
        if (!prevItem || prevItem !== e) return e // local modified → keep local
        return remoteItem // local untouched → accept remote
    })

    // Append new remote entries not present locally
    for (const re of remote) {
        if (!merged.find(e => e.id === re.id)) {
            merged.push(re)
        }
    }

    return merged
}

/**
 * 3-way merge for media items during incremental sync.
 *
 * When hasUnsyncedChanges is true (previous save failed), always keeps ALL
 * local items and only appends new remote items to prevent data loss.
 *
 * Otherwise uses the standard 3-way merge strategy (same as mergeEntries).
 */
export function mergeMediaItems<T extends Identifiable>(
    local: T[],
    remote: T[],
    prev: T[],
    hasUnsyncedChanges: boolean,
): T[] {
    if (hasUnsyncedChanges) {
        // Unsynced local edits exist — keep ALL local, only add new remote items
        const localIds = new Set(local.map(m => m.id))
        return [
            ...local,
            ...remote.filter(m => !localIds.has(m.id))
        ]
    }

    // Normal 3-way merge
    return mergeEntries(local, remote, prev, [])
}

/**
 * Merge strategy for full fetch (initial load / forced refresh).
 *
 * Local always wins — only appends items that exist on remote but not locally.
 * This protects any unsaved local edits during a full reload.
 */
export function mergeMediaItemsFull<T extends Identifiable>(
    local: T[],
    remote: T[],
): T[] {
    const localIds = new Set(local.map(m => m.id))
    return [
        ...local,
        ...remote.filter(m => !localIds.has(m.id))
    ]
}
