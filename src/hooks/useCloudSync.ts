import { useState, useEffect, useCallback, useRef } from 'react'
import type { Entry, ContentType, CloudData, ImportDataPayload } from '../types'

const STORAGE_KEY = 'chronolog_cloud_auth'
const SYNC_DEBOUNCE_MS = 2000

interface CloudSyncState {
    isLoggedIn: boolean
    isSyncing: boolean
    lastSynced: number | null
    error: string | null
}

interface CloudAuthStorage {
    token: string
    expiresAt: number
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

// Get API base URL - empty for same origin in production
const getApiBase = (): string => {
    return ''
}

export function useCloudSync({ entries, contentTypes, onImportData }: UseCloudSyncProps): UseCloudSyncReturn {
    const [syncState, setSyncState] = useState<CloudSyncState>({
        isLoggedIn: false,
        isSyncing: false,
        lastSynced: null,
        error: null,
    })

    const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const tokenRef = useRef<string | null>(null)
    const lastDataRef = useRef<string | null>(null)

    // Fetch data from cloud (works with or without token)
    const fetchRemoteData = useCallback(async (token: string | null) => {
        try {
            setSyncState(prev => ({ ...prev, isSyncing: true, error: null }))

            const headers: Record<string, string> = {}
            if (token) {
                headers['Authorization'] = `Bearer ${token}`
            }

            const response = await fetch(`${getApiBase()}/api/data`, { headers })

            if (!response.ok) {
                throw new Error('Failed to fetch data')
            }

            const remoteData: CloudData = await response.json()

            // Cloud-first strategy: use remote data if it exists
            if (remoteData && remoteData.entries && remoteData.entries.length > 0) {
                onImportData({
                    entries: remoteData.entries,
                    contentTypes: remoteData.contentTypes,
                })
                lastDataRef.current = JSON.stringify(remoteData)
            }

            setSyncState(prev => ({
                ...prev,
                isSyncing: false,
                lastSynced: Date.now()
            }))
        } catch (error) {
            setSyncState(prev => ({
                ...prev,
                isSyncing: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }))
        }
    }, [onImportData])

    // Load saved token on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            try {
                const { token, expiresAt }: CloudAuthStorage = JSON.parse(saved)
                if (expiresAt > Date.now()) {
                    tokenRef.current = token
                    setSyncState(prev => ({ ...prev, isLoggedIn: true }))
                    fetchRemoteData(token)
                } else {
                    localStorage.removeItem(STORAGE_KEY)
                    fetchRemoteData(null)
                }
            } catch (e) {
                localStorage.removeItem(STORAGE_KEY)
                fetchRemoteData(null)
            }
        } else {
            fetchRemoteData(null)
        }
    }, [fetchRemoteData])

    // Save data to cloud
    const saveToCloud = useCallback(async () => {
        if (!tokenRef.current) return

        const dataToSync = { entries, contentTypes }
        const dataString = JSON.stringify(dataToSync)

        // Skip if data hasn't changed
        if (dataString === lastDataRef.current) return

        try {
            setSyncState(prev => ({ ...prev, isSyncing: true, error: null }))

            const response = await fetch(`${getApiBase()}/api/data`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${tokenRef.current}`,
                    'Content-Type': 'application/json',
                },
                body: dataString,
            })

            if (!response.ok) {
                throw new Error('Failed to save data')
            }

            lastDataRef.current = dataString
            setSyncState(prev => ({
                ...prev,
                isSyncing: false,
                lastSynced: Date.now()
            }))
        } catch (error) {
            setSyncState(prev => ({
                ...prev,
                isSyncing: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }))
        }
    }, [entries])

    // Auto-sync when data changes (debounced)
    useEffect(() => {
        if (!syncState.isLoggedIn) return

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
    }, [entries, syncState.isLoggedIn, saveToCloud])

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
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                token: data.token,
                expiresAt: data.expiresAt,
            }))

            setSyncState(prev => ({
                ...prev,
                isLoggedIn: true,
                isSyncing: false
            }))

            // Fetch remote data after login
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
        localStorage.removeItem(STORAGE_KEY)
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
