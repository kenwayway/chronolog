import { useState, useEffect, useCallback, useRef } from 'react'
import { STORAGE_KEYS, getStorage, setStorage, removeStorage, type CloudAuthData } from '../utils/storageService'

interface AuthResponse {
    success?: boolean
    token: string
    expiresAt: number
    error?: string
}

export interface LoginResult {
    success: boolean
    error?: string
}

export interface CloudAuthState {
    isLoggedIn: boolean
    token: string | null
}

export interface UseCloudAuthReturn extends CloudAuthState {
    login: (password: string) => Promise<LoginResult>
    logout: () => void
    tokenRef: React.MutableRefObject<string | null>
}

// Get API base URL - empty for same origin in production
export const getApiBase = (): string => {
    return ''
}

/**
 * Manages cloud authentication: login, logout, and token persistence.
 * Extracted from useCloudSync for separation of concerns.
 */
export function useCloudAuth(onLoginSuccess?: (token: string) => void): UseCloudAuthReturn {
    const [authState, setAuthState] = useState<CloudAuthState>({
        isLoggedIn: false,
        token: null,
    })

    const tokenRef = useRef<string | null>(null)

    // Load saved token on mount
    useEffect(() => {
        const saved = getStorage<CloudAuthData>(STORAGE_KEYS.CLOUD_AUTH)
        if (saved && saved.expiresAt > Date.now()) {
            tokenRef.current = saved.token
            setAuthState({ isLoggedIn: true, token: saved.token })
            onLoginSuccess?.(saved.token)
        } else if (saved) {
            removeStorage(STORAGE_KEYS.CLOUD_AUTH)
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Login with password
    const login = useCallback(async (password: string): Promise<LoginResult> => {
        try {
            const response = await fetch(`${getApiBase()}/api/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

            setAuthState({ isLoggedIn: true, token: data.token })
            onLoginSuccess?.(data.token)

            return { success: true }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            return { success: false, error: errorMsg }
        }
    }, [onLoginSuccess])

    // Logout
    const logout = useCallback(() => {
        tokenRef.current = null
        removeStorage(STORAGE_KEYS.CLOUD_AUTH)
        setAuthState({ isLoggedIn: false, token: null })
    }, [])

    return {
        ...authState,
        login,
        logout,
        tokenRef,
    }
}
