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

/** Result of the backend AI health check (GET /api/categorize) */
export interface TestAIResult {
    ok: boolean;
    model?: string;
    error?: string;
    /** Sample categorization result proving the full round-trip works */
    sample?: { category: string | null; contentType: string };
}

/** Full cloud sync interface with all methods - used by SettingsModal */
export interface CloudSyncFull extends CloudSyncStatus {
    lastSynced?: number | null;
    error?: string | null;
    login: (password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    sync: () => void;
    cleanupImages: () => Promise<{ deleted: string[]; kept: string[] }>;
    testAI: () => Promise<TestAIResult>;
}
