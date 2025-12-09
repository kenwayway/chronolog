import { useState, useEffect, useCallback } from 'react';

const GOOGLE_CLIENT_ID = '822449560941-p3fd199i26cadg42h8a4um4sclvl38q3.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/tasks';
const STORAGE_KEY = 'chronolog_google_token';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/tasks/v1/rest';

export function useGoogleTasks() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tokenClient, setTokenClient] = useState(null);

    // Load Google Identity Services
    useEffect(() => {
        const loadGoogleScript = () => {
            // Check if already loaded
            if (window.google?.accounts?.oauth2) {
                initializeClient();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = initializeClient;
            document.head.appendChild(script);
        };

        const initializeClient = () => {
            try {
                const client = window.google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: SCOPES,
                    callback: handleTokenResponse,
                });
                setTokenClient(client);

                // Check for existing token
                const storedToken = localStorage.getItem(STORAGE_KEY);
                if (storedToken) {
                    const tokenData = JSON.parse(storedToken);
                    // Check if token is still valid (with 5 min buffer)
                    if (tokenData.expires_at > Date.now() + 300000) {
                        setIsLoggedIn(true);
                    } else {
                        localStorage.removeItem(STORAGE_KEY);
                    }
                }
                setIsLoading(false);
            } catch (err) {
                setError(err.message);
                setIsLoading(false);
            }
        };

        loadGoogleScript();
    }, []);

    const handleTokenResponse = useCallback((response) => {
        if (response.error) {
            setError(response.error);
            return;
        }

        // Store token with expiration
        const tokenData = {
            access_token: response.access_token,
            expires_at: Date.now() + (response.expires_in * 1000),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tokenData));
        setIsLoggedIn(true);
        setError(null);
    }, []);

    const getAccessToken = useCallback(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;
        const tokenData = JSON.parse(stored);
        if (tokenData.expires_at < Date.now()) {
            localStorage.removeItem(STORAGE_KEY);
            setIsLoggedIn(false);
            return null;
        }
        return tokenData.access_token;
    }, []);

    const login = useCallback(() => {
        if (tokenClient) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        }
    }, [tokenClient]);

    const logout = useCallback(() => {
        const token = getAccessToken();
        if (token) {
            window.google?.accounts?.oauth2?.revoke(token);
        }
        localStorage.removeItem(STORAGE_KEY);
        setIsLoggedIn(false);
    }, [getAccessToken]);

    // API helper
    const apiRequest = useCallback(async (endpoint, options = {}) => {
        const token = getAccessToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`https://tasks.googleapis.com/tasks/v1${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            if (response.status === 401) {
                logout();
                throw new Error('Session expired, please login again');
            }
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `API error: ${response.status}`);
        }

        return response.json();
    }, [getAccessToken, logout]);

    // Get default task list
    const getDefaultTaskList = useCallback(async () => {
        const lists = await apiRequest('/users/@me/lists');
        return lists.items?.[0]?.id || '@default';
    }, [apiRequest]);

    // List pending tasks
    const listTasks = useCallback(async () => {
        try {
            const listId = await getDefaultTaskList();
            const result = await apiRequest(`/lists/${listId}/tasks?showCompleted=false`);
            return result.items || [];
        } catch (err) {
            setError(err.message);
            return [];
        }
    }, [apiRequest, getDefaultTaskList]);

    // Create a new task
    const createTask = useCallback(async (title, entryId) => {
        try {
            const listId = await getDefaultTaskList();
            const task = await apiRequest(`/lists/${listId}/tasks`, {
                method: 'POST',
                body: JSON.stringify({
                    title,
                    notes: `chronolog:${entryId}`,
                }),
            });
            return task;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [apiRequest, getDefaultTaskList]);

    // Complete a task
    const completeTask = useCallback(async (taskId) => {
        try {
            const listId = await getDefaultTaskList();
            const task = await apiRequest(`/lists/${listId}/tasks/${taskId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    status: 'completed',
                }),
            });
            return task;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [apiRequest, getDefaultTaskList]);

    // Delete a task
    const deleteTask = useCallback(async (taskId) => {
        try {
            const listId = await getDefaultTaskList();
            await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${getAccessToken()}`,
                },
            });
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [getAccessToken, getDefaultTaskList]);

    // Parse entry ID from task notes
    const parseEntryId = useCallback((task) => {
        if (!task.notes) return null;
        const match = task.notes.match(/^chronolog:(.+)$/);
        return match ? match[1] : null;
    }, []);

    return {
        isLoggedIn,
        isLoading,
        error,
        login,
        logout,
        listTasks,
        createTask,
        completeTask,
        deleteTask,
        parseEntryId,
    };
}
