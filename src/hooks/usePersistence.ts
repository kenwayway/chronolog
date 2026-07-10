import { useEffect, useCallback, useRef } from 'react'
import { STORAGE_KEYS, setStorage } from '@/utils/storageService'
import type { SessionState } from '@/types'

type PersistedState = Pick<SessionState, 'status' | 'sessionStart' | 'entries' | 'contentTypes' | 'mediaItems'>

/**
 * Debounced localStorage persistence for session state.
 * Batches rapid state changes into a single write (500ms debounce)
 * and flushes on page unload to prevent data loss.
 *
 * latestStateRef is updated from the persistence effect so render stays pure.
 */
export function usePersistence(state: SessionState) {
    const latestStateRef = useRef<PersistedState>({
        status: state.status,
        sessionStart: state.sessionStart,
        entries: state.entries,
        contentTypes: state.contentTypes,
        mediaItems: state.mediaItems,
    })
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const flushSave = useCallback(() => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current)
            saveTimerRef.current = null
        }
        setStorage(STORAGE_KEYS.STATE, latestStateRef.current)
    }, [])

    // Debounced save: batches rapid state changes into a single localStorage write
    useEffect(() => {
        latestStateRef.current = {
            status: state.status,
            sessionStart: state.sessionStart,
            entries: state.entries,
            contentTypes: state.contentTypes,
            mediaItems: state.mediaItems,
        }
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(flushSave, 500)
    }, [state.status, state.sessionStart, state.entries, state.contentTypes, state.mediaItems, flushSave])

    // Flush on page unload — latestStateRef is already current so no race possible
    useEffect(() => {
        const handleBeforeUnload = () => flushSave()
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
            flushSave()
        }
    }, [flushSave])
}
