import { useEffect, useCallback, useRef } from 'react'
import { queuePersistedSessionState } from '@/utils/indexedDbService'
import type { SessionState } from '@/types'

type PersistedState = Pick<SessionState, 'status' | 'sessionStart' | 'entries' | 'contentTypes' | 'mediaItems'>

/**
 * Debounced IndexedDB persistence for session state. Entity stores are updated
 * incrementally, so a single entry edit does not rewrite the full history.
 *
 * latestStateRef is updated from the persistence effect so render stays pure.
 */
export function usePersistence(state: SessionState, isHydrated: boolean) {
    const latestStateRef = useRef<PersistedState>({
        status: state.status,
        sessionStart: state.sessionStart,
        entries: state.entries,
        contentTypes: state.contentTypes,
        mediaItems: state.mediaItems,
    })
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const flushSave = useCallback(() => {
        if (!isHydrated) return
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current)
            saveTimerRef.current = null
        }
        const current = latestStateRef.current
        void queuePersistedSessionState(current)
    }, [isHydrated])

    // Debounced save: batches rapid state changes into a single localStorage write
    useEffect(() => {
        latestStateRef.current = {
            status: state.status,
            sessionStart: state.sessionStart,
            entries: state.entries,
            contentTypes: state.contentTypes,
            mediaItems: state.mediaItems,
        }
        if (!isHydrated) return
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(flushSave, 500)
    }, [state.status, state.sessionStart, state.entries, state.contentTypes, state.mediaItems, isHydrated, flushSave])

    // Start the async write as soon as the page is hidden or being unloaded.
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') flushSave()
        }
        window.addEventListener('pagehide', flushSave)
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            window.removeEventListener('pagehide', flushSave)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            flushSave()
        }
    }, [flushSave])
}
