import { useEffect, useCallback, useRef } from 'react'
import { STORAGE_KEYS, setStorage } from '@/utils/storageService'
import type { SessionState } from '@/types'

type PersistedState = Pick<SessionState, 'status' | 'sessionStart' | 'entries' | 'contentTypes' | 'mediaItems'>

/**
 * Debounced localStorage persistence for session state.
 * Batches rapid state changes into a single write (500ms debounce)
 * and flushes on page unload to prevent data loss.
 *
 * latestStateRef is updated synchronously during render (not in an effect)
 * so the beforeunload handler always has the most current state even if the
 * user refreshes before React's effects have run.
 */
export function usePersistence(state: SessionState) {
    // Updated synchronously during render — always reflects current state
    const latestStateRef = useRef<PersistedState>({
        status: state.status,
        sessionStart: state.sessionStart,
        entries: state.entries,
        contentTypes: state.contentTypes,
        mediaItems: state.mediaItems,
    })
    latestStateRef.current = {
        status: state.status,
        sessionStart: state.sessionStart,
        entries: state.entries,
        contentTypes: state.contentTypes,
        mediaItems: state.mediaItems,
    }

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
