import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'chronolog_cloud_auth';
const SYNC_DEBOUNCE_MS = 2000;

// Get API base URL - empty for same origin in production
const getApiBase = () => {
    // In development, you might need to set this
    return '';
};

export function useCloudSync({ entries, tasks, categories, onImportData }) {
    const [syncState, setSyncState] = useState({
        isLoggedIn: false,
        isSyncing: false,
        lastSynced: null,
        error: null,
    });

    const syncTimeoutRef = useRef(null);
    const tokenRef = useRef(null);
    const lastDataRef = useRef(null);

    // Load saved token on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const { token, expiresAt } = JSON.parse(saved);
                if (expiresAt > Date.now()) {
                    tokenRef.current = token;
                    setSyncState(prev => ({ ...prev, isLoggedIn: true }));
                    // Fetch remote data on login restore
                    fetchRemoteData(token);
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                    // Still fetch public data even if token expired
                    fetchRemoteData(null);
                }
            } catch (e) {
                localStorage.removeItem(STORAGE_KEY);
                fetchRemoteData(null);
            }
        } else {
            // No saved token - fetch public data for all visitors
            fetchRemoteData(null);
        }
    }, []);

    // Fetch data from cloud (works with or without token)
    const fetchRemoteData = async (token) => {
        try {
            setSyncState(prev => ({ ...prev, isSyncing: true, error: null }));

            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${getApiBase()}/api/data`, { headers });

            if (!response.ok) {
                throw new Error('Failed to fetch data');
            }

            const remoteData = await response.json();

            // Cloud-first strategy: use remote data if it exists
            if (remoteData && remoteData.entries && remoteData.entries.length > 0) {
                onImportData({
                    entries: remoteData.entries,
                    tasks: remoteData.tasks || [],
                    categories: remoteData.categories,
                });
                lastDataRef.current = JSON.stringify(remoteData);
            }

            setSyncState(prev => ({
                ...prev,
                isSyncing: false,
                lastSynced: Date.now()
            }));
        } catch (error) {
            setSyncState(prev => ({
                ...prev,
                isSyncing: false,
                error: error.message
            }));
        }
    };

    // Save data to cloud
    const saveToCloud = useCallback(async () => {
        if (!tokenRef.current) return;

        const dataToSync = { entries, tasks, categories };
        const dataString = JSON.stringify(dataToSync);

        // Skip if data hasn't changed
        if (dataString === lastDataRef.current) return;

        try {
            setSyncState(prev => ({ ...prev, isSyncing: true, error: null }));

            const response = await fetch(`${getApiBase()}/api/data`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${tokenRef.current}`,
                    'Content-Type': 'application/json',
                },
                body: dataString,
            });

            if (!response.ok) {
                throw new Error('Failed to save data');
            }

            lastDataRef.current = dataString;
            setSyncState(prev => ({
                ...prev,
                isSyncing: false,
                lastSynced: Date.now()
            }));
        } catch (error) {
            setSyncState(prev => ({
                ...prev,
                isSyncing: false,
                error: error.message
            }));
        }
    }, [entries, tasks, categories]);

    // Auto-sync when data changes (debounced)
    useEffect(() => {
        if (!syncState.isLoggedIn) return;

        if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
        }

        syncTimeoutRef.current = setTimeout(() => {
            saveToCloud();
        }, SYNC_DEBOUNCE_MS);

        return () => {
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
            }
        };
    }, [entries, tasks, categories, syncState.isLoggedIn, saveToCloud]);

    // Login with password
    const login = useCallback(async (password) => {
        try {
            setSyncState(prev => ({ ...prev, isSyncing: true, error: null }));

            const response = await fetch(`${getApiBase()}/api/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Save token
            tokenRef.current = data.token;
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                token: data.token,
                expiresAt: data.expiresAt,
            }));

            setSyncState(prev => ({
                ...prev,
                isLoggedIn: true,
                isSyncing: false
            }));

            // Fetch remote data after login
            await fetchRemoteData(data.token);

            return { success: true };
        } catch (error) {
            setSyncState(prev => ({
                ...prev,
                isSyncing: false,
                error: error.message
            }));
            return { success: false, error: error.message };
        }
    }, []);

    // Logout
    const logout = useCallback(() => {
        tokenRef.current = null;
        localStorage.removeItem(STORAGE_KEY);
        setSyncState({
            isLoggedIn: false,
            isSyncing: false,
            lastSynced: null,
            error: null,
        });
    }, []);

    // Upload image
    const uploadImage = useCallback(async (file) => {
        if (!tokenRef.current) {
            throw new Error('Not logged in');
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${getApiBase()}/api/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokenRef.current}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }

        const result = await response.json();
        return result.url;
    }, []);

    // Manual sync
    const sync = useCallback(async () => {
        if (!tokenRef.current) return;
        await saveToCloud();
    }, [saveToCloud]);

    return {
        ...syncState,
        login,
        logout,
        sync,
        uploadImage,
    };
}
