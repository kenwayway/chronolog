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
import type { Entry, ContentType, MediaItem, ImportDataPayload, TestAIResult } from '@/types'
import { useCloudAuth, type LoginResult } from './useCloudAuth'
import { useImageUpload, type CleanupResult } from './useImageUpload'
import { useAIHealthCheck } from './useAIHealthCheck'
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
  testAI: () => Promise<TestAIResult>
  token: string | null
}

export function useCloudSync({ entries, contentTypes, mediaItems, onImportData }: UseCloudSyncProps): UseCloudSyncReturn {
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isSyncingRef = useRef(false)

  // Toast notifications
  const { addToast } = useToast()
  const prevHadErrorRef = useRef(false)
  const prevNotionFailedRef = useRef(0)

  // Core sync engine
  const engine = useSyncEngine({ entries, contentTypes, mediaItems, onImportData })
  const {
    syncState,
    fetchRemoteData,
    saveToCloud,
    isImporting,
    resetSyncState,
    clearSyncTimestamp,
  } = engine

  // Keep isSyncing ref in sync
  useEffect(() => { isSyncingRef.current = syncState.isSyncing }, [syncState.isSyncing])

  // --- Toast on sync error / recovery ---
  useEffect(() => {
    if (syncState.error && !prevHadErrorRef.current) {
      addToast(`同步失败: ${syncState.error}`, 'error')
    }
    if (!syncState.error && prevHadErrorRef.current) {
      addToast('同步已恢复', 'success')
    }
    prevHadErrorRef.current = !!syncState.error
  }, [syncState.error, addToast])

  useEffect(() => {
    const failed = syncState.notionSync.failed
    if (failed > 0 && prevNotionFailedRef.current === 0) {
      addToast(`Notion 同步待重试: ${syncState.notionSync.lastError || `${failed} 个任务待处理`}`, 'info', 7000)
    } else if (failed === 0 && prevNotionFailedRef.current > 0) {
      addToast('Notion 工时同步已恢复', 'success')
    }
    prevNotionFailedRef.current = failed
  }, [syncState.notionSync.failed, syncState.notionSync.lastError, addToast])

  // --- Auth ---
  const handleLoginSuccess = useCallback((token: string) => {
    // Preserve the pull revision across normal app restarts. Logout explicitly
    // clears it, while a restored token continues incrementally.
    fetchRemoteData(token)
  }, [fetchRemoteData])

  const auth = useCloudAuth(handleLoginSuccess)
  const { isLoggedIn, token, tokenRef, login, logout: logoutAuth } = auth

  // Fetch on mount for unauthenticated case
  useEffect(() => {
    if (!isLoggedIn) {
      const savedAuth = localStorage.getItem('chronolog_cloud_auth')
      if (!savedAuth) {
        fetchRemoteData(null, true)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Image operations ---
  const { uploadImage, cleanupImages } = useImageUpload(tokenRef)

  // --- AI health check (backend AI_API_KEY validity) ---
  const { testAI } = useAIHealthCheck(tokenRef)

  // --- Visibility-aware periodic polling ---
  // Pauses when the tab is hidden, resumes immediately when visible
  useEffect(() => {
    if (!isLoggedIn || !tokenRef.current) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    const startPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = setInterval(() => {
        if (!isSyncingRef.current && tokenRef.current) {
          fetchRemoteData(tokenRef.current)
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
        if (!isSyncingRef.current && tokenRef.current) {
          fetchRemoteData(tokenRef.current)
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
  }, [isLoggedIn, tokenRef, fetchRemoteData])

  // --- Debounced auto-sync on data changes ---
  useEffect(() => {
    if (!isLoggedIn) return
    if (isImporting()) return

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = setTimeout(() => saveToCloud(tokenRef.current), SYNC_DEBOUNCE_MS)

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    }
  }, [entries, contentTypes, mediaItems, isLoggedIn, tokenRef, isImporting, saveToCloud])

  // --- Flush on page unload ---
  // This network flush is best-effort; correctness comes from the durable
  // IndexedDB outbox, which is replayed on the next launch.
  useEffect(() => {
    if (!isLoggedIn) return
    const handleBeforeUnload = () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
      }
      const token = tokenRef.current
      if (!token) return

      void saveToCloud(token)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isLoggedIn, tokenRef, saveToCloud])

  // --- Manual sync (bidirectional) ---
  const sync = useCallback(async () => {
    if (!tokenRef.current) return
    await saveToCloud(tokenRef.current)
    await fetchRemoteData(tokenRef.current)
  }, [fetchRemoteData, saveToCloud, tokenRef])

  // --- Logout with cleanup ---
  const logout = useCallback(() => {
    logoutAuth()
    clearSyncTimestamp()
    resetSyncState()
  }, [logoutAuth, clearSyncTimestamp, resetSyncState])

  return {
    ...syncState,
    isLoggedIn,
    login,
    logout,
    sync,
    uploadImage,
    cleanupImages,
    testAI,
    token,
  }
}
