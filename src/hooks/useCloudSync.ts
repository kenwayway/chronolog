import { useState, useEffect, useCallback, useRef } from 'react'
import type { Entry, ContentType, MediaItem, CloudData, ImportDataPayload } from '@/types'
import { useCloudAuth, getApiBase, type LoginResult } from './useCloudAuth'
import { useImageUpload, type CleanupResult } from './useImageUpload'
import { computeDiff } from '@/utils/syncDiff'


const SYNC_DEBOUNCE_MS = 500
const POLL_INTERVAL_MS = 30_000 // Poll for changes from other devices every 30s

interface CloudSyncState {
  isSyncing: boolean
  lastSynced: number | null
  error: string | null
}

interface UseCloudSyncProps {
  entries: Entry[]
  contentTypes: ContentType[]
  mediaItems: MediaItem[]
  onImportData: (data: ImportDataPayload) => void
}

interface UseCloudSyncReturn extends CloudSyncState {
  isLoggedIn: boolean
  login: (password: string) => Promise<LoginResult>
  logout: () => void
  sync: () => Promise<void>
  uploadImage: (file: File) => Promise<string>
  cleanupImages: () => Promise<CleanupResult>
  token: string | null
}

// Storage key for last sync timestamp
const LAST_SYNC_KEY = 'chronolog_last_sync_at'

export function useCloudSync({ entries, contentTypes, mediaItems, onImportData }: UseCloudSyncProps): UseCloudSyncReturn {
  const [syncState, setSyncState] = useState<CloudSyncState>({
    isSyncing: false,
    lastSynced: null,
    error: null,
  })

  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isSyncingRef = useRef(false)
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
  // Prevents the poll from overwriting local with stale server data.
  const hasUnsyncedChangesRef = useRef(false)

  // Keep refs in sync with props
  useEffect(() => { entriesRef.current = entries }, [entries])
  useEffect(() => { contentTypesRef.current = contentTypes }, [contentTypes])
  useEffect(() => { mediaItemsRef.current = mediaItems }, [mediaItems])
  useEffect(() => { onImportDataRef.current = onImportData }, [onImportData])
  useEffect(() => { isSyncingRef.current = syncState.isSyncing }, [syncState.isSyncing])

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
          let mergedEntries = entriesRef.current

          if (hasEntryChanges) {
            const currentEntries = [...entriesRef.current]

            // Remove deleted entries
            const deletedSet = new Set(deletedIds)
            const filteredEntries = deletedSet.size > 0
              ? currentEntries.filter(e => !deletedSet.has(e.id))
              : currentEntries

            // Merge: update existing + add new from remote
            const remoteEntryMap = new Map(remoteEntries.map(e => [e.id, e]))
            const prevEntryMap = new Map(prevEntriesRef.current.map(e => [e.id, e]))
            mergedEntries = filteredEntries.map(e => {
              const remote = remoteEntryMap.get(e.id)
              if (!remote) return e
              const prev = prevEntryMap.get(e.id)
              if (!prev || prev !== e) return e // local modified → keep local
              return remote // local untouched → accept remote
            })
            for (const re of remoteEntries) {
              if (!mergedEntries.find(e => e.id === re.id)) {
                mergedEntries.push(re)
              }
            }
          }

          // Merge media items: if save has failed, always keep local to prevent data loss
          let mergedMediaItems: typeof remoteMediaItems | undefined
          if (hasMediaChanges) {
            if (hasUnsyncedChangesRef.current) {
              // Unsynced local edits exist — keep ALL local, only add new remote items
              const localMedia = mediaItemsRef.current
              const localIds = new Set(localMedia.map(m => m.id))
              mergedMediaItems = [
                ...localMedia,
                ...remoteMediaItems.filter(m => !localIds.has(m.id))
              ]
            } else {
              // Normal 3-way merge
              const currentMedia = [...mediaItemsRef.current]
              const remoteMediaMap = new Map(remoteMediaItems.map(m => [m.id, m]))
              const prevMediaMap = new Map(prevMediaItemsRef.current.map(m => [m.id, m]))
              mergedMediaItems = currentMedia.map(m => {
                const remote = remoteMediaMap.get(m.id)
                if (!remote) return m
                const prev = prevMediaMap.get(m.id)
                if (!prev || prev !== m) return m // local modified → keep local
                return remote // local untouched → accept remote
              })
              for (const rm of remoteMediaItems) {
                if (!mergedMediaItems.find(m => m.id === rm.id)) {
                  mergedMediaItems.push(rm)
                }
              }
            }
          }

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
          // Merge media: local always wins (local is authoritative on reload),
          // only append items that exist on remote but not yet locally (e.g. from other devices)
          const localMedia = mediaItemsRef.current
          const localIds = new Set(localMedia.map(m => m.id))
          const mergedMedia = [
            ...localMedia, // keep all local items as-is (may have unsaved edits)
            ...remoteMediaItems.filter(m => !localIds.has(m.id)) // add new remote-only items
          ]

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
        // Only snapshot media items if there are no unsynced local changes,
        // otherwise we lose the diff baseline and the next poll would overwrite
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

  // --- Auth (composed from useCloudAuth) ---
  const handleLoginSuccess = useCallback((token: string) => {
    localStorage.removeItem(LAST_SYNC_KEY)
    fetchRemoteData(token, true)
  }, [fetchRemoteData])

  const auth = useCloudAuth(handleLoginSuccess)

  // Also fetch on mount for unauthenticated case
  useEffect(() => {
    if (!auth.isLoggedIn) {
      // Token already handled by useCloudAuth's onLoginSuccess callback
      // Only fetch if there's no saved auth at all
      const savedAuth = localStorage.getItem('chronolog_cloud_auth')
      if (!savedAuth) {
        fetchRemoteData(null, true)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Image operations (composed from useImageUpload) ---
  const { uploadImage, cleanupImages } = useImageUpload(auth.tokenRef)

  // --- Periodic polling ---
  useEffect(() => {
    if (!auth.isLoggedIn || !auth.tokenRef.current) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    pollIntervalRef.current = setInterval(() => {
      if (!isSyncingRef.current && auth.tokenRef.current) {
        fetchRemoteData(auth.tokenRef.current)
      }
    }, POLL_INTERVAL_MS)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [auth.isLoggedIn, fetchRemoteData, auth.tokenRef])

  // --- Save changes to cloud (incremental diff) ---
  const saveToCloud = useCallback(async () => {
    if (!auth.tokenRef.current) return
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
        keepalive: true, // ensures request completes even if page is unloading
        headers: {
          'Authorization': `Bearer ${auth.tokenRef.current}`,
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
  }, [auth.tokenRef])

  // --- Auto-sync on data changes (debounced) ---
  useEffect(() => {
    if (!auth.isLoggedIn) return
    if (isImportingRef.current) return

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = setTimeout(() => saveToCloud(), SYNC_DEBOUNCE_MS)

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    }
  }, [entries, contentTypes, mediaItems, auth.isLoggedIn, saveToCloud])

  // --- Flush pending cloud save on page unload (bypass debounce) ---
  useEffect(() => {
    if (!auth.isLoggedIn) return
    const handleBeforeUnload = () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = null
      }
      saveToCloud()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [auth.isLoggedIn, saveToCloud])

  // --- Manual sync (bidirectional) ---
  const sync = useCallback(async () => {
    if (!auth.tokenRef.current) return
    await saveToCloud()
    await fetchRemoteData(auth.tokenRef.current)
  }, [saveToCloud, fetchRemoteData, auth.tokenRef])

  // --- Logout with cleanup ---
  const logout = useCallback(() => {
    auth.logout()
    localStorage.removeItem(LAST_SYNC_KEY)
    prevEntriesRef.current = []
    prevContentTypesRef.current = []
    prevMediaItemsRef.current = []
    pendingDeletedIdsRef.current = []
    setSyncState({ isSyncing: false, lastSynced: null, error: null })
  }, [auth])

  return {
    ...syncState,
    isLoggedIn: auth.isLoggedIn,
    login: auth.login,
    logout,
    sync,
    uploadImage,
    cleanupImages,
    token: auth.tokenRef.current,
  }
}
