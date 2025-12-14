/**
 * Unified localStorage service
 * Centralizes all storage keys and provides type-safe get/set/remove operations
 */

// All storage keys in one place
export const STORAGE_KEYS = {
    // Session state
    STATE: 'chronolog_state',
    API_KEY: 'chronolog_api_key',
    AI_BASE_URL: 'chronolog_ai_base_url',
    AI_MODEL: 'chronolog_ai_model',

    // Auth tokens
    CLOUD_AUTH: 'chronolog_cloud_auth',
    GOOGLE_TOKEN: 'chronolog_google_token',

    // UI preferences
    THEME: 'chronolog_theme',
} as const

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]

/**
 * Get a value from localStorage
 * @param key - Storage key
 * @returns Parsed JSON value or null if not found/invalid
 */
export function getStorage<T>(key: StorageKey): T | null {
    try {
        const value = localStorage.getItem(key)
        if (value === null) return null
        return JSON.parse(value) as T
    } catch {
        return null
    }
}

/**
 * Get a raw string value from localStorage (no JSON parsing)
 * @param key - Storage key
 * @returns Raw string value or null
 */
export function getStorageRaw(key: StorageKey): string | null {
    return localStorage.getItem(key)
}

/**
 * Set a value in localStorage
 * @param key - Storage key
 * @param value - Value to store (will be JSON stringified)
 */
export function setStorage<T>(key: StorageKey, value: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(value))
    } catch (e) {
        console.error('Failed to save to localStorage:', e)
    }
}

/**
 * Set a raw string value in localStorage (no JSON stringify)
 * @param key - Storage key
 * @param value - Raw string value
 */
export function setStorageRaw(key: StorageKey, value: string): void {
    try {
        localStorage.setItem(key, value)
    } catch (e) {
        console.error('Failed to save to localStorage:', e)
    }
}

/**
 * Remove a value from localStorage
 * @param key - Storage key
 */
export function removeStorage(key: StorageKey): void {
    localStorage.removeItem(key)
}

// Type definitions for stored data
export interface CloudAuthData {
    token: string
    expiresAt: number
}

export interface GoogleTokenData {
    access_token: string
    expires_at: number
}

export interface ThemeData {
    themeName: string
    accentColor: string
    isDark: boolean
}
