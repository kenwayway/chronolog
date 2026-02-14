import { useState, useEffect, useCallback, useRef } from 'react'
import type { Entry, ContentType, MediaItem, CloudData, ImportDataPayload } from '../types'
import { useCloudAuth, getApiBase, type LoginResult } from './useCloudAuth'
import { useImageUpload, type CleanupResult } from './useImageUpload'

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
        const deletedIds = remoteData.deletedIds || []

        if (remoteEntries.length === 0 && deletedIds.length === 0) {
          // Nothing changed remotely
        } else {
          const currentEntries = [...entriesRef.current]

          // Remove deleted entries
          const deletedSet = new Set(deletedIds)
          const filteredEntries = deletedSet.size > 0
            ? currentEntries.filter(e => !deletedSet.has(e.id))
            : currentEntries

          // Merge: update existing + add new from remote
          const remoteEntryMap = new Map(remoteEntries.map(e => [e.id, e]))
          const prevEntryMap = new Map(prevEntriesRef.current.map(e => [e.id, e]))
          const mergedEntries = filteredEntries.map(e => {
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

          isImportingRef.current = true
          onImportDataRef.current({
            entries: mergedEntries,
            contentTypes: remoteData.contentTypes?.length ? remoteData.contentTypes : undefined,
            mediaItems: remoteData.mediaItems?.length ? remoteData.mediaItems : undefined,
          })
        }
      } else {
        // --- FULL FETCH: replace everything ---
        const remoteEntries = remoteData.entries || []
        const remoteContentTypes = remoteData.contentTypes || []
        const hasRemoteData = remoteEntries.length > 0 || remoteContentTypes.length > 0

        if (hasRemoteData) {
          // One-time migration: convert category=beans/sparks to contentType=beans/sparks
          const migratedEntries = remoteEntries.map(entry => {
            const legacyCategory = entry.category as string | undefined
            if ((legacyCategory === 'beans' || legacyCategory === 'sparks') && !entry.contentType) {
              return { ...entry, contentType: legacyCategory, category: undefined }
            }
            return entry
          })

          isImportingRef.current = true
          onImportDataRef.current({
            entries: migratedEntries,
            contentTypes: remoteData.contentTypes,
            mediaItems: remoteData.mediaItems,
          })
        }
      }

      const now = Date.now()
      localStorage.setItem(LAST_SYNC_KEY, String(now))

      // Snapshot current state after React flushes
      setTimeout(() => {
        prevEntriesRef.current = [...entriesRef.current]
        prevContentTypesRef.current = [...contentTypesRef.current]
        prevMediaItemsRef.current = [...mediaItemsRef.current]
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

    // Compute entry diff
    const prevEntryMap = new Map(prevEntriesRef.current.map(e => [e.id, e]))
    const changedEntries: Entry[] = []
    for (const entry of currentEntries) {
      const prev = prevEntryMap.get(entry.id)
      if (!prev || prev !== entry) changedEntries.push(entry)
    }

    // Detect deleted entries
    const currentIds = new Set(currentEntries.map(e => e.id))
    const newlyDeleted = prevEntriesRef.current
      .filter(e => !currentIds.has(e.id))
      .map(e => e.id)
    if (newlyDeleted.length > 0) {
      pendingDeletedIdsRef.current.push(...newlyDeleted)
    }

    // Compute content type diff
    const prevCtMap = new Map(prevContentTypesRef.current.map(ct => [ct.id, ct]))
    const changedContentTypes: ContentType[] = []
    for (const ct of currentContentTypes) {
      const prev = prevCtMap.get(ct.id)
      if (!prev || prev !== ct) changedContentTypes.push(ct)
    }
    const currentCtIds = new Set(currentContentTypes.map(ct => ct.id))
    const deletedContentTypeIds = prevContentTypesRef.current
      .filter(ct => !currentCtIds.has(ct.id) && !ct.builtIn)
      .map(ct => ct.id)

    // Compute media item diff
    const prevMiMap = new Map(prevMediaItemsRef.current.map(mi => [mi.id, mi]))
    const changedMediaItems: MediaItem[] = []
    for (const mi of currentMediaItems) {
      const prev = prevMiMap.get(mi.id)
      if (!prev || prev !== mi) changedMediaItems.push(mi)
    }
    const currentMiIds = new Set(currentMediaItems.map(mi => mi.id))
    const deletedMediaItemIds = prevMediaItemsRef.current
      .filter(mi => !currentMiIds.has(mi.id))
      .map(mi => mi.id)

    const deletedIds = [...pendingDeletedIdsRef.current]

    // Nothing changed? Update refs and skip
    if (changedEntries.length === 0 && deletedIds.length === 0 &&
      changedContentTypes.length === 0 && deletedContentTypeIds.length === 0 &&
      changedMediaItems.length === 0 && deletedMediaItemIds.length === 0) {
      prevEntriesRef.current = [...currentEntries]
      prevContentTypesRef.current = [...currentContentTypes]
      prevMediaItemsRef.current = [...currentMediaItems]
      return
    }

    try {
      setSyncState(prev => ({ ...prev, isSyncing: true, error: null }))

      const payload: Record<string, unknown> = {}
      if (changedEntries.length > 0) payload.entries = changedEntries
      if (deletedIds.length > 0) payload.deletedIds = deletedIds
      if (changedContentTypes.length > 0) payload.contentTypes = changedContentTypes
      if (deletedContentTypeIds.length > 0) payload.deletedContentTypeIds = deletedContentTypeIds
      if (changedMediaItems.length > 0) payload.mediaItems = changedMediaItems
      if (deletedMediaItemIds.length > 0) payload.deletedMediaItemIds = deletedMediaItemIds

      const response = await fetch(`${getApiBase()}/api/data`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${auth.tokenRef.current}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error('Failed to save data')

      pendingDeletedIdsRef.current = []

      const now = Date.now()
      localStorage.setItem(LAST_SYNC_KEY, String(now))

      prevEntriesRef.current = [...currentEntries]
      prevContentTypesRef.current = [...currentContentTypes]
      prevMediaItemsRef.current = [...currentMediaItems]

      setSyncState(prev => ({ ...prev, isSyncing: false, lastSynced: now }))
    } catch (error) {
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
