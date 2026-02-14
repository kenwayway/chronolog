import { createContext, useContext } from 'react'

export interface CloudSyncContextValue {
    isLoggedIn: boolean
    isSyncing: boolean
    lastSynced: number | null
    error: string | null
    login: (password: string) => Promise<{ success: boolean; error?: string }>
    logout: () => void
    sync: () => Promise<void>
    uploadImage: (file: File) => Promise<string>
    cleanupImages: () => Promise<{ deleted: string[]; kept: string[] }>
    token: string | null
}

export const CloudSyncContext = createContext<CloudSyncContextValue | null>(null)

/**
 * Access cloud sync state and methods from context.
 * Must be used within a component wrapped by CloudSyncContext.Provider.
 */
export function useCloudSyncContext(): CloudSyncContextValue {
    const ctx = useContext(CloudSyncContext)
    if (!ctx) throw new Error('useCloudSyncContext must be used within CloudSyncContext.Provider')
    return ctx
}
