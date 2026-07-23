/**
 * React adapter for the framework-independent SyncCoordinator.
 *
 * This hook owns no sync protocol state. It only reports immutable application
 * snapshots, keeps the import callback fresh, and exposes stable React-facing
 * methods/state.
 */
import { useCallback, useEffect, useState } from 'react'
import type { ContentType, ImportDataPayload, MediaItem, Note, Session } from '@/types'
import { SyncCoordinator, type SyncState } from '@/features/sync'
import { getApiBase } from './useCloudAuth'

export type { SyncState } from '@/features/sync'

export interface UseSyncEngineProps {
    notes: Note[]
    sessions: Session[]
    contentTypes: ContentType[]
    mediaItems: MediaItem[]
    onImportData: (data: ImportDataPayload) => void
}

export interface UseSyncEngineReturn {
    syncState: SyncState
    fetchRemoteData: (token: string | null, forceFullFetch?: boolean) => Promise<void>
    saveToCloud: (token: string | null) => Promise<void>
    isImporting: () => boolean
    resetSyncState: () => void
    clearSyncTimestamp: () => void
}

export function useSyncEngine({
    notes,
    sessions,
    contentTypes,
    mediaItems,
    onImportData,
}: UseSyncEngineProps): UseSyncEngineReturn {
    const [coordinator] = useState(
        () => new SyncCoordinator({
            initialData: { notes, sessions, contentTypes, mediaItems },
            importData: onImportData,
            apiBase: getApiBase,
        }),
    )
    const [syncState, setSyncState] = useState<SyncState>(() => coordinator.getState())

    useEffect(
        () => coordinator.subscribe(setSyncState),
        [coordinator],
    )

    useEffect(() => {
        coordinator.setImportHandler(onImportData)
    }, [coordinator, onImportData])

    useEffect(() => {
        void coordinator.observeData({ notes, sessions, contentTypes, mediaItems })
    }, [coordinator, notes, sessions, contentTypes, mediaItems])

    const fetchRemoteData = useCallback(
        (token: string | null, forceFullFetch = false) => coordinator.pull(token, forceFullFetch),
        [coordinator],
    )

    const saveToCloud = useCallback(
        (token: string | null) => coordinator.push(token),
        [coordinator],
    )

    const isImporting = useCallback(
        () => coordinator.isImporting(),
        [coordinator],
    )

    const resetSyncState = useCallback(
        () => coordinator.resetState(),
        [coordinator],
    )

    const clearSyncTimestamp = useCallback(
        () => coordinator.clearPullCursor(),
        [coordinator],
    )

    return {
        syncState,
        fetchRemoteData,
        saveToCloud,
        isImporting,
        resetSyncState,
        clearSyncTimestamp,
    }
}
