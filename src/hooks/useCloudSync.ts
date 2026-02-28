/**
 * Cloud sync composition hook.
 *
 * Thin layer that wires together:
 * - useSyncEngine (fetch/push + state)
 * - useCloudAuth (login/logout)
 * - useImageUpload (upload/cleanup)
 * - useToast (user-facing notifications)
 * - Auto-sync, polling, and beforeunload effects
 *
 * Public API is identical to the pre-refactor version.
 */
import { useEffect, useCallback, useRef } from 'react'
import type { Entry, ContentType, MediaItem, ImportDataPayload } from '@/types'
import { useCloudAuth, type LoginResult } from './useCloudAuth'
import { useImageUpload, type CleanupResult } from './useImageUpload'
import { useSyncEngine, type SyncState } from './useSyncEngine'
import { useToast } from './useToast'

const SYNC_DEBOUNCE_MS = 500
const POLL_INTERVAL_MS = 30_000

interface UseCloudSyncProps {
  entries: Entry[]
  contentTypes: ContentType[]
  mediaItems: MediaItem[]
  onImportData: (data: ImportDataPayload) => void
}

interface UseCloudSyncReturn extends SyncState {
  isLoggedIn: boolean
  login: (password: string) => Promise<LoginResult>
  logout: () => void
  sync: () => Promise<void>
  uploadImage: (file: File) => Promise<string>
  cleanupImages: () => Promise<CleanupResult>
  token: string | null
}

export function useCloudSync({ entries, contentTypes, mediaItems, onImportData }: UseCloudSyncProps): UseCloudSyncReturn {
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isSyncingRef = useRef(false)

  // Toast notifications
  const { addToast } = useToast()
  const prevHadErrorRef = useRef(false)

  // Core sync engine
  const engine = useSyncEngine({ entries, contentTypes, mediaItems, onImportData })

  // Keep isSyncing ref in sync
  useEffect(() => { isSyncingRef.current = engine.syncState.isSyncing }, [engine.syncState.isSyncing])

  // --- Toast on sync error / recovery ---
  useEffect(() => {
    if (engine.syncState.error && !prevHadErrorRef.current) {
      addToast(`同步失败: ${engine.syncState.error}`, 'error')
    }
    if (!engine.syncState.error && prevHadErrorRef.current) {
      addToast('同步已恢复', 'success')
    }
    prevHadErrorRef.current = !!engine.syncState.error
  }, [engine.syncState.error, addToast])

  // --- Auth ---
  const handleLoginSuccess = useCallback((token: string) => {
    engine.clearSyncTimestamp()
    engine.fetchRemoteData(token, true)
  }, [engine])

  const auth = useCloudAuth(handleLoginSuccess)

  // Fetch on mount for unauthenticated case
  useEffect(() => {
    if (!auth.isLoggedIn) {
      const savedAuth = localStorage.getItem('chronolog_cloud_auth')
      if (!savedAuth) {
        engine.fetchRemoteData(null, true)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Image operations ---
  const { uploadImage, cleanupImages } = useImageUpload(auth.tokenRef)

  // --- Visibility-aware periodic polling ---
  // Pauses when the tab is hidden, resumes immediately when visible
  useEffect(() => {
    if (!auth.isLoggedIn || !auth.tokenRef.current) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    const startPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = setInterval(() => {
        if (!isSyncingRef.current && auth.tokenRef.current) {
          engine.fetchRemoteData(auth.tokenRef.current)
        }
      }, POLL_INTERVAL_MS)
    }

    const stopPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling()
      } else {
        // Fetch immediately on return, then resume interval
        if (!isSyncingRef.current && auth.tokenRef.current) {
          engine.fetchRemoteData(auth.tokenRef.current)
        }
        startPolling()
      }
    }

    // Start polling (only if tab is currently visible)
    if (!document.hidden) {
      startPolling()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [auth.isLoggedIn, engine, auth.tokenRef])

  // --- Debounced auto-sync on data changes ---
  useEffect(() => {
    if (!auth.isLoggedIn) return
    if (engine.isImporting()) return

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = setTimeout(() => engine.saveToCloud(auth.tokenRef.current), SYNC_DEBOUNCE_MS)

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    }
  }, [entries, contentTypes, mediaItems, auth.isLoggedIn, engine, auth.tokenRef])

  // --- Flush on page unload ---
  useEffect(() => {
    if (!auth.isLoggedIn) return
    const handleBeforeUnload = () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
      }
      engine.saveToCloud(auth.tokenRef.current)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [auth.isLoggedIn, engine, auth.tokenRef])

  // --- Manual sync (bidirectional) ---
  const sync = useCallback(async () => {
    if (!auth.tokenRef.current) return
    await engine.saveToCloud(auth.tokenRef.current)
    await engine.fetchRemoteData(auth.tokenRef.current)
  }, [engine, auth.tokenRef])

  // --- Logout with cleanup ---
  const logout = useCallback(() => {
    auth.logout()
    engine.clearSyncTimestamp()
    engine.resetSyncState()
  }, [auth, engine])

  return {
    ...engine.syncState,
    isLoggedIn: auth.isLoggedIn,
    login: auth.login,
    logout,
    sync,
    uploadImage,
    cleanupImages,
    token: auth.tokenRef.current,
  }
}
