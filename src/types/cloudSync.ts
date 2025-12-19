/**
 * Shared interface types for CloudSync functionality
 * Used by Header, InputPanel, SettingsModal, and App
 */

/** Basic cloud sync status - used by Header and InputPanel */
export interface CloudSyncStatus {
    isLoggedIn: boolean;
    isSyncing: boolean;
}

/** Cloud sync with image upload capability - used by InputPanel */
export interface CloudSyncWithUpload extends CloudSyncStatus {
    uploadImage: (file: File) => Promise<string>;
}

/** Full cloud sync interface with all methods - used by SettingsModal */
export interface CloudSyncFull extends CloudSyncStatus {
    lastSynced?: number;
    error?: string;
    login: (password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    sync: () => void;
    cleanupImages: () => Promise<{ deletedCount: number; totalImages: number; error?: string }>;
}

/** Google Tasks integration interface */
export interface GoogleTasksStatus {
    isLoggedIn: boolean;
    isLoading: boolean;
    error?: string;
    login: () => void;
    logout: () => void;
}
