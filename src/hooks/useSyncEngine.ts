/**
 * Core sync engine — handles fetching remote data, pushing local changes,
 * and managing all the ref-based bookkeeping for incremental sync.
 *
 * Extracted from useCloudSync for separation of concerns.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Entry, ContentType, MediaItem, CloudData, ImportDataPayload } from '@/types'
import { getApiBase } from './useCloudAuth'
import { computeDiff } from '@/utils/syncDiff'
import { mergeEntries, mergeMediaItems, mergeMediaItemsFull } from '@/utils/syncMerge'

const LAST_SYNC_KEY = 'chronolog_last_sync_at'

export interface SyncState {
    isSyncing: boolean
    lastSynced: number | null
    error: string | null
}

export interface UseSyncEngineProps {
    entries: Entry[]
    contentTypes: ContentType[]
    mediaItems: MediaItem[]
    onImportData: (data: ImportDataPayload) => void
}

export interface UseSyncEngineReturn {
    syncState: SyncState
    fetchRemoteData: (token: string | null, forceFullFetch?: boolean) => Promise<void>
    saveToCloud: (token: string | null) => Promise<void>
    /** Current importing flag — true means data is being imported from remote */
    isImporting: () => boolean
    /** Reset all sync state (used on logout) */
    resetSyncState: () => void
    /** Clear the last-sync timestamp from localStorage */
    clearSyncTimestamp: () => void
}

export function useSyncEngine({
    entries,
    contentTypes,
    mediaItems,
    onImportData,
}: UseSyncEngineProps): UseSyncEngineReturn {
    const [syncState, setSyncState] = useState<SyncState>({
        isSyncing: false,
        lastSynced: null,
        error: null,
    })

    const isInitialFetchRef = useRef(true)

    // Use refs for data to avoid dependency cycles
    const entriesRef = useRef<Entry[]>(entries)
    const contentTypesRef = useRef<ContentType[]>(contentTypes)
    const mediaItemsRef = useRef<MediaItem[]>(mediaItems)
    const onImportDataRef = useRef(onImportData)

    // Track previous data for diffing
    const prevEntriesRef = useRef<Entry[]>([])
    const prevContentTypesRef = useRef<ContentType[]>([])
    const prevMediaItemsRef = useRef<MediaItem[]>([])

    // Track pending deletions
    const pendingDeletedIdsRef = useRef<string[]>([])

    // Flag to skip sync triggers during initial data import
    const isImportingRef = useRef(false)

    // Flag: true when saveToCloud has failed and local edits haven't been pushed yet.
    const hasUnsyncedChangesRef = useRef(false)

    // Keep refs in sync with props
    useEffect(() => { entriesRef.current = entries }, [entries])
    useEffect(() => { contentTypesRef.current = contentTypes }, [contentTypes])
    useEffect(() => { mediaItemsRef.current = mediaItems }, [mediaItems])
    useEffect(() => { onImportDataRef.current = onImportData }, [onImportData])

    // --- Fetch remote data (full or incremental) ---
    const fetchRemoteData = useCallback(async (token: string | null, forceFullFetch = false) => {
        try {
            setSyncState(prev => ({ ...prev, isSyncing: true, error: null }))

            const headers: Record<string, string> = {}
            if (token) {
                headers['Authorization'] = `Bearer ${token}`
            }

            let url = `${getApiBase()}/api/data`
            const savedSyncAt = localStorage.getItem(LAST_SYNC_KEY)
            if (savedSyncAt && token && !forceFullFetch && !isInitialFetchRef.current) {
                url += `?since=${savedSyncAt}`
            }

            const response = await fetch(url, { headers })

            if (!response.ok) {
                throw new Error(`Failed to fetch data: ${response.status}`)
            }

            const remoteData: CloudData & { deletedIds?: string[], incremental?: boolean } = await response.json()

            if (remoteData.incremental) {
                // --- INCREMENTAL FETCH: merge with local state ---
                const remoteEntries = remoteData.entries || []
                const remoteMediaItems = remoteData.mediaItems || []
                const deletedIds = remoteData.deletedIds || []

                const hasEntryChanges = remoteEntries.length > 0 || deletedIds.length > 0
                const hasMediaChanges = remoteMediaItems.length > 0

                if (hasEntryChanges || hasMediaChanges || (remoteData.contentTypes?.length ?? 0) > 0) {
                    const mergedEntries = hasEntryChanges
                        ? mergeEntries(entriesRef.current, remoteEntries, prevEntriesRef.current, deletedIds)
                        : entriesRef.current

                    const mergedMediaItems = hasMediaChanges
                        ? mergeMediaItems(mediaItemsRef.current, remoteMediaItems, prevMediaItemsRef.current, hasUnsyncedChangesRef.current)
                        : undefined

                    isImportingRef.current = true
                    onImportDataRef.current({
                        entries: mergedEntries,
                        contentTypes: remoteData.contentTypes?.length ? remoteData.contentTypes : undefined,
                        mediaItems: mergedMediaItems,
                    })
                }
            } else {
                // --- FULL FETCH: merge with local to protect unsaved edits ---
                const remoteEntries = remoteData.entries || []
                const remoteContentTypes = remoteData.contentTypes || []
                const remoteMediaItems = remoteData.mediaItems || []
                const hasRemoteData = remoteEntries.length > 0 || remoteContentTypes.length > 0 || remoteMediaItems.length > 0

                if (hasRemoteData) {
                    const mergedMedia = mergeMediaItemsFull(mediaItemsRef.current, remoteMediaItems)

                    isImportingRef.current = true
                    onImportDataRef.current({
                        entries: remoteEntries,
                        contentTypes: remoteData.contentTypes,
                        mediaItems: mergedMedia.length > 0 ? mergedMedia : undefined,
                    })
                }
            }

            const now = Date.now()
            localStorage.setItem(LAST_SYNC_KEY, String(now))

            // Snapshot current state after React flushes
            setTimeout(() => {
                prevEntriesRef.current = [...entriesRef.current]
                prevContentTypesRef.current = [...contentTypesRef.current]
                if (!hasUnsyncedChangesRef.current) {
                    prevMediaItemsRef.current = [...mediaItemsRef.current]
                }
                isImportingRef.current = false
                isInitialFetchRef.current = false
            }, 500)

            setSyncState(prev => ({ ...prev, isSyncing: false, lastSynced: now }))
        } catch (error) {
            setSyncState(prev => ({
                ...prev,
                isSyncing: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }))
        }
    }, [])

    // --- Save changes to cloud (incremental diff) ---
    const saveToCloud = useCallback(async (token: string | null) => {
        if (!token) return
        if (isImportingRef.current) return

        const currentEntries = entriesRef.current
        const currentContentTypes = contentTypesRef.current
        const currentMediaItems = mediaItemsRef.current

        // Compute diffs using generic utility
        const entryDiff = computeDiff(prevEntriesRef.current, currentEntries)
        const ctDiff = computeDiff(prevContentTypesRef.current, currentContentTypes, ct => !ct.builtIn)
        const miDiff = computeDiff(prevMediaItemsRef.current, currentMediaItems)

        // Accumulate entry deletions across calls
        if (entryDiff.deletedIds.length > 0) {
            pendingDeletedIdsRef.current.push(...entryDiff.deletedIds)
        }

        const deletedIds = [...pendingDeletedIdsRef.current]

        // Nothing changed? Update refs and skip
        if (entryDiff.changed.length === 0 && deletedIds.length === 0 &&
            ctDiff.changed.length === 0 && ctDiff.deletedIds.length === 0 &&
            miDiff.changed.length === 0 && miDiff.deletedIds.length === 0) {
            prevEntriesRef.current = [...currentEntries]
            prevContentTypesRef.current = [...currentContentTypes]
            prevMediaItemsRef.current = [...currentMediaItems]
            return
        }

        try {
            setSyncState(prev => ({ ...prev, isSyncing: true, error: null }))

            const payload: Record<string, unknown> = {}
            if (entryDiff.changed.length > 0) payload.entries = entryDiff.changed
            if (deletedIds.length > 0) payload.deletedIds = deletedIds
            if (ctDiff.changed.length > 0) payload.contentTypes = ctDiff.changed
            if (ctDiff.deletedIds.length > 0) payload.deletedContentTypeIds = ctDiff.deletedIds
            if (miDiff.changed.length > 0) payload.mediaItems = miDiff.changed
            if (miDiff.deletedIds.length > 0) payload.deletedMediaItemIds = miDiff.deletedIds

            const response = await fetch(`${getApiBase()}/api/data`, {
                method: 'PUT',
                keepalive: true,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const errBody = await response.text().catch(() => '')
                throw new Error(`Save failed (${response.status}): ${errBody}`)
            }

            pendingDeletedIdsRef.current = []
            hasUnsyncedChangesRef.current = false

            const now = Date.now()
            localStorage.setItem(LAST_SYNC_KEY, String(now))

            prevEntriesRef.current = [...currentEntries]
            prevContentTypesRef.current = [...currentContentTypes]
            prevMediaItemsRef.current = [...currentMediaItems]

            setSyncState(prev => ({ ...prev, isSyncing: false, lastSynced: now }))
        } catch (error) {
            hasUnsyncedChangesRef.current = true
            setSyncState(prev => ({
                ...prev,
                isSyncing: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }))
        }
    }, [])

    const isImporting = useCallback(() => isImportingRef.current, [])

    const resetSyncState = useCallback(() => {
        prevEntriesRef.current = []
        prevContentTypesRef.current = []
        prevMediaItemsRef.current = []
        pendingDeletedIdsRef.current = []
        setSyncState({ isSyncing: false, lastSynced: null, error: null })
    }, [])

    const clearSyncTimestamp = useCallback(() => {
        localStorage.removeItem(LAST_SYNC_KEY)
    }, [])

    return {
        syncState,
        fetchRemoteData,
        saveToCloud,
        isImporting,
        resetSyncState,
        clearSyncTimestamp,
    }
}
