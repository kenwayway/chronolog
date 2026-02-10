import { useState, useEffect, useCallback, useRef } from 'react'
import type { Entry, ContentType, MediaItem, CloudData, ImportDataPayload } from '../types'
import { STORAGE_KEYS, getStorage, setStorage, removeStorage, type CloudAuthData } from '../utils/storageService'

const SYNC_DEBOUNCE_MS = 500

interface CloudSyncState {
  isLoggedIn: boolean
  isSyncing: boolean
  lastSynced: number | null
  error: string | null
}

interface AuthResponse {
  success?: boolean
  token: string
  expiresAt: number
  error?: string
}

interface LoginResult {
  success: boolean
  error?: string
}

interface CleanupResult {
  deleted: string[]
  kept: string[]
}

interface UseCloudSyncProps {
  entries: Entry[]
  contentTypes: ContentType[]
  mediaItems: MediaItem[]
  onImportData: (data: ImportDataPayload) => void
}

interface UseCloudSyncReturn extends CloudSyncState {
  login: (password: string) => Promise<LoginResult>
  logout: () => void
  sync: () => Promise<void>
  uploadImage: (file: File) => Promise<string>
  cleanupImages: () => Promise<CleanupResult>
  token: string | null
}

// Storage key for last sync timestamp
const LAST_SYNC_KEY = 'chronolog_last_sync_at'

// Get API base URL - empty for same origin in production
const getApiBase = (): string => {
  return ''
}

export function useCloudSync({ entries, contentTypes, mediaItems, onImportData }: UseCloudSyncProps): UseCloudSyncReturn {
  const [syncState, setSyncState] = useState<CloudSyncState>({
    isLoggedIn: false,
    isSyncing: false,
    lastSynced: null,
    error: null,
  })

  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tokenRef = useRef<string | null>(null)

  // Use refs for data to avoid dependency cycles
  const entriesRef = useRef<Entry[]>(entries)
  const contentTypesRef = useRef<ContentType[]>(contentTypes)
  const mediaItemsRef = useRef<MediaItem[]>(mediaItems)
  const onImportDataRef = useRef(onImportData)

  // Track previous data for diffing (to determine what changed)
  const prevEntriesRef = useRef<Entry[]>([])
  const prevContentTypesRef = useRef<ContentType[]>([])
  const prevMediaItemsRef = useRef<MediaItem[]>([])

  // Track pending deletions (entry IDs deleted locally that need to be synced)
  const pendingDeletedIdsRef = useRef<string[]>([])

  // Flag to skip sync triggers during initial data import
  const isImportingRef = useRef(false)

  // Keep refs in sync with props (no re-renders, no dependency cycles)
  useEffect(() => { entriesRef.current = entries }, [entries])
  useEffect(() => { contentTypesRef.current = contentTypes }, [contentTypes])
  useEffect(() => { mediaItemsRef.current = mediaItems }, [mediaItems])
  useEffect(() => { onImportDataRef.current = onImportData }, [onImportData])

  // Fetch data from cloud (full or incremental)
  // NO dependencies on entries/contentTypes/mediaItems — uses refs instead
  const fetchRemoteData = useCallback(async (token: string | null) => {
    try {
      setSyncState(prev => ({ ...prev, isSyncing: true, error: null }))

      const headers: Record<string, string> = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Use incremental fetch if we have a last sync timestamp
      let url = `${getApiBase()}/api/data`
      const savedSyncAt = localStorage.getItem(LAST_SYNC_KEY)
      if (savedSyncAt && token) {
        url += `?since=${savedSyncAt}`
      }

      const response = await fetch(url, { headers })

      if (!response.ok) {
        throw new Error('Failed to fetch data')
      }

      const remoteData: CloudData & { deletedIds?: string[], incremental?: boolean } = await response.json()

      if (remoteData.incremental && remoteData.deletedIds && remoteData.deletedIds.length > 0) {
        // Handle deleted entries from other devices
        const deletedSet = new Set(remoteData.deletedIds)
        const currentEntries = [...entriesRef.current]
        const filteredEntries = currentEntries.filter(e => !deletedSet.has(e.id))

        // Merge new/updated entries from remote
        const remoteEntries = remoteData.entries || []
        const remoteEntryMap = new Map(remoteEntries.map(e => [e.id, e]))

        // Update or add remote entries
        const mergedEntries = filteredEntries.map(e =>
          remoteEntryMap.has(e.id) ? remoteEntryMap.get(e.id)! : e
        )
        // Add entries from remote that don't exist locally
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
      } else {
        // Full fetch - replace everything
        const hasRemoteData = remoteData && (
          (remoteData.entries && remoteData.entries.length > 0) ||
          (remoteData.contentTypes && remoteData.contentTypes.length > 0)
        )

        if (hasRemoteData) {
          // One-time migration: convert category=beans/sparks to contentType=beans/sparks
          let migrated = false
          const migratedEntries = (remoteData.entries || []).map(entry => {
            const legacyCategory = entry.category as string | undefined
            if ((legacyCategory === 'beans' || legacyCategory === 'sparks') && !entry.contentType) {
              migrated = true
              return {
                ...entry,
                contentType: legacyCategory,
                category: undefined,
              }
            }
            return entry
          })

          if (migrated) {
            console.log('[Migration] Converted beans/sparks categories to content types')
          }

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

      // After import, snapshot current state as "previous" to avoid re-uploading imported data
      // Use a microtask to ensure state has been updated by React
      setTimeout(() => {
        prevEntriesRef.current = [...entriesRef.current]
        prevContentTypesRef.current = [...contentTypesRef.current]
        prevMediaItemsRef.current = [...mediaItemsRef.current]
        isImportingRef.current = false
      }, 300)

      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        lastSynced: now,
      }))
    } catch (error) {
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }, []) // No dependencies — uses refs for all dynamic data

  // Load saved token on mount (runs once)
  useEffect(() => {
    const saved = getStorage<CloudAuthData>(STORAGE_KEYS.CLOUD_AUTH)
    if (saved) {
      if (saved.expiresAt > Date.now()) {
        tokenRef.current = saved.token
        setSyncState(prev => ({ ...prev, isLoggedIn: true }))
        fetchRemoteData(saved.token)
      } else {
        removeStorage(STORAGE_KEYS.CLOUD_AUTH)
        fetchRemoteData(null)
      }
    } else {
      fetchRemoteData(null)
    }
  }, [fetchRemoteData])

  // Save changes to cloud (incremental)
  const saveToCloud = useCallback(async () => {
    if (!tokenRef.current) return
    if (isImportingRef.current) return

    const currentEntries = entriesRef.current
    const currentContentTypes = contentTypesRef.current
    const currentMediaItems = mediaItemsRef.current

    // Compute diff: find entries that were added or changed
    const prevEntryMap = new Map(prevEntriesRef.current.map(e => [e.id, e]))
    const changedEntries: Entry[] = []

    for (const entry of currentEntries) {
      const prev = prevEntryMap.get(entry.id)
      if (!prev || JSON.stringify(prev) !== JSON.stringify(entry)) {
        changedEntries.push(entry)
      }
    }

    // Detect deleted entries
    const currentIds = new Set(currentEntries.map(e => e.id))
    const newlyDeleted = prevEntriesRef.current
      .filter(e => !currentIds.has(e.id))
      .map(e => e.id)

    if (newlyDeleted.length > 0) {
      pendingDeletedIdsRef.current.push(...newlyDeleted)
    }

    // Compute content type changes
    const prevCtMap = new Map(prevContentTypesRef.current.map(ct => [ct.id, ct]))
    const changedContentTypes: ContentType[] = []
    for (const ct of currentContentTypes) {
      const prev = prevCtMap.get(ct.id)
      if (!prev || JSON.stringify(prev) !== JSON.stringify(ct)) {
        changedContentTypes.push(ct)
      }
    }

    // Detect deleted content types
    const currentCtIds = new Set(currentContentTypes.map(ct => ct.id))
    const deletedContentTypeIds = prevContentTypesRef.current
      .filter(ct => !currentCtIds.has(ct.id) && !ct.builtIn)
      .map(ct => ct.id)

    // Compute media item changes
    const prevMiMap = new Map(prevMediaItemsRef.current.map(mi => [mi.id, mi]))
    const changedMediaItems: MediaItem[] = []
    for (const mi of currentMediaItems) {
      const prev = prevMiMap.get(mi.id)
      if (!prev || JSON.stringify(prev) !== JSON.stringify(mi)) {
        changedMediaItems.push(mi)
      }
    }

    // Detect deleted media items
    const currentMiIds = new Set(currentMediaItems.map(mi => mi.id))
    const deletedMediaItemIds = prevMediaItemsRef.current
      .filter(mi => !currentMiIds.has(mi.id))
      .map(mi => mi.id)

    const deletedIds = [...pendingDeletedIdsRef.current]

    // Nothing changed? Skip
    if (changedEntries.length === 0 && deletedIds.length === 0 &&
      changedContentTypes.length === 0 && deletedContentTypeIds.length === 0 &&
      changedMediaItems.length === 0 && deletedMediaItemIds.length === 0) {
      // Update refs even when nothing changed
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
          'Authorization': `Bearer ${tokenRef.current}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Failed to save data')
      }

      // Clear pending deletions on success
      pendingDeletedIdsRef.current = []

      const now = Date.now()
      localStorage.setItem(LAST_SYNC_KEY, String(now))

      // Update refs to current state
      prevEntriesRef.current = [...currentEntries]
      prevContentTypesRef.current = [...currentContentTypes]
      prevMediaItemsRef.current = [...currentMediaItems]

      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        lastSynced: now,
      }))
    } catch (error) {
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }, []) // No dependencies — uses refs for all dynamic data

  // Auto-sync when data changes (debounced)
  useEffect(() => {
    if (!syncState.isLoggedIn) return
    if (isImportingRef.current) return

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }

    syncTimeoutRef.current = setTimeout(() => {
      saveToCloud()
    }, SYNC_DEBOUNCE_MS)

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [entries, contentTypes, mediaItems, syncState.isLoggedIn, saveToCloud])

  // Login with password
  const login = useCallback(async (password: string): Promise<LoginResult> => {
    try {
      setSyncState(prev => ({ ...prev, isSyncing: true, error: null }))

      const response = await fetch(`${getApiBase()}/api/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })

      const data: AuthResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      // Save token
      tokenRef.current = data.token
      setStorage<CloudAuthData>(STORAGE_KEYS.CLOUD_AUTH, {
        token: data.token,
        expiresAt: data.expiresAt,
      })

      setSyncState(prev => ({
        ...prev,
        isLoggedIn: true,
        isSyncing: false
      }))

      // Fetch remote data after login (full fetch since we just logged in)
      localStorage.removeItem(LAST_SYNC_KEY)
      await fetchRemoteData(data.token)

      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        error: errorMsg
      }))
      return { success: false, error: errorMsg }
    }
  }, [fetchRemoteData])

  // Logout
  const logout = useCallback(() => {
    tokenRef.current = null
    removeStorage(STORAGE_KEYS.CLOUD_AUTH)
    localStorage.removeItem(LAST_SYNC_KEY)
    prevEntriesRef.current = []
    prevContentTypesRef.current = []
    prevMediaItemsRef.current = []
    pendingDeletedIdsRef.current = []
    setSyncState({
      isLoggedIn: false,
      isSyncing: false,
      lastSynced: null,
      error: null,
    })
  }, [])

  // Upload image
  const uploadImage = useCallback(async (file: File): Promise<string> => {
    if (!tokenRef.current) {
      throw new Error('Not logged in')
    }

    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${getApiBase()}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenRef.current}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json() as { error?: string }
      throw new Error(error.error || 'Upload failed')
    }

    const result = await response.json() as { url: string }
    return result.url
  }, [])

  // Manual sync
  const sync = useCallback(async () => {
    if (!tokenRef.current) return
    await saveToCloud()
  }, [saveToCloud])

  // Cleanup unreferenced images
  const cleanupImages = useCallback(async (): Promise<CleanupResult> => {
    if (!tokenRef.current) {
      throw new Error('Not logged in')
    }

    const response = await fetch(`${getApiBase()}/api/cleanup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenRef.current}`,
      },
    })

    if (!response.ok) {
      const error = await response.json() as { error?: string }
      throw new Error(error.error || 'Cleanup failed')
    }

    return await response.json() as CleanupResult
  }, [])

  return {
    ...syncState,
    login,
    logout,
    sync,
    uploadImage,
    cleanupImages,
    token: tokenRef.current,
  }
}
