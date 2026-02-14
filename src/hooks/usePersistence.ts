import { useEffect, useCallback, useRef } from 'react'
import { STORAGE_KEYS, setStorage } from '../utils/storageService'
import type { SessionState } from '../types'

/**
 * Debounced localStorage persistence for session state.
 * Batches rapid state changes into a single write (500ms debounce)
 * and flushes on page unload to prevent data loss.
 */
export function usePersistence(state: SessionState) {
    const pendingSaveRef = useRef<Partial<SessionState> | null>(null)
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const flushSave = useCallback(() => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current)
            saveTimerRef.current = null
        }
        if (pendingSaveRef.current) {
            setStorage(STORAGE_KEYS.STATE, pendingSaveRef.current)
            pendingSaveRef.current = null
        }
    }, [])

    // Debounced save: batches rapid state changes into a single localStorage write
    useEffect(() => {
        pendingSaveRef.current = {
            status: state.status,
            sessionStart: state.sessionStart,
            entries: state.entries,
            contentTypes: state.contentTypes,
            mediaItems: state.mediaItems
        }

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(flushSave, 500)
    }, [state.status, state.sessionStart, state.entries, state.contentTypes, state.mediaItems, flushSave])

    // Flush pending save on page unload / component unmount
    useEffect(() => {
        const handleBeforeUnload = () => flushSave()
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
            flushSave()
        }
    }, [flushSave])
}
