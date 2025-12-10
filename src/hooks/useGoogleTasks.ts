import { useState, useEffect, useCallback } from 'react'

const GOOGLE_CLIENT_ID = '822449560941-p3fd199i26cadg42h8a4um4sclvl38q3.apps.googleusercontent.com'
const SCOPES = 'https://www.googleapis.com/auth/tasks'
const STORAGE_KEY = 'chronolog_google_token'

interface TokenData {
    access_token: string
    expires_at: number
}

interface TokenResponse {
    access_token: string
    expires_in: number
    error?: string
}

interface GoogleTask {
    id: string
    title: string
    notes?: string
    status?: string
}

interface TaskListResponse {
    items?: { id: string }[]
}

interface TasksResponse {
    items?: GoogleTask[]
}

interface UseGoogleTasksReturn {
    isLoggedIn: boolean
    isLoading: boolean
    error: string | null
    login: () => void
    logout: () => void
    listTasks: () => Promise<GoogleTask[]>
    createTask: (title: string, entryId: string) => Promise<GoogleTask>
    completeTask: (taskId: string) => Promise<GoogleTask>
    deleteTask: (taskId: string) => Promise<void>
    parseEntryId: (task: GoogleTask) => string | null
}

// Extend window for Google API types
declare global {
    interface Window {
        google?: {
            accounts?: {
                oauth2?: {
                    initTokenClient: (config: {
                        client_id: string
                        scope: string
                        callback: (response: TokenResponse) => void
                    }) => { requestAccessToken: (options?: { prompt?: string }) => void }
                    revoke: (token: string) => void
                }
            }
        }
    }
}

export function useGoogleTasks(): UseGoogleTasksReturn {
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [tokenClient, setTokenClient] = useState<{ requestAccessToken: (options?: { prompt?: string }) => void } | null>(null)

    const handleTokenResponse = useCallback((response: TokenResponse) => {
        if (response.error) {
            setError(response.error)
            return
        }

        const tokenData: TokenData = {
            access_token: response.access_token,
            expires_at: Date.now() + (response.expires_in * 1000),
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tokenData))
        setIsLoggedIn(true)
        setError(null)
    }, [])

    // Load Google Identity Services
    useEffect(() => {
        const initializeClient = () => {
            try {
                if (!window.google?.accounts?.oauth2) {
                    throw new Error('Google API not loaded')
                }
                const client = window.google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: SCOPES,
                    callback: handleTokenResponse,
                })
                setTokenClient(client)

                // Check for existing token
                const storedToken = localStorage.getItem(STORAGE_KEY)
                if (storedToken) {
                    const tokenData: TokenData = JSON.parse(storedToken)
                    if (tokenData.expires_at > Date.now() + 300000) {
                        setIsLoggedIn(true)
                    } else {
                        localStorage.removeItem(STORAGE_KEY)
                    }
                }
                setIsLoading(false)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error')
                setIsLoading(false)
            }
        }

        const loadGoogleScript = () => {
            if (window.google?.accounts?.oauth2) {
                initializeClient()
                return
            }

            const script = document.createElement('script')
            script.src = 'https://accounts.google.com/gsi/client'
            script.async = true
            script.defer = true
            script.onload = initializeClient
            document.head.appendChild(script)
        }

        loadGoogleScript()
    }, [handleTokenResponse])

    const getAccessToken = useCallback((): string | null => {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return null
        const tokenData: TokenData = JSON.parse(stored)
        if (tokenData.expires_at < Date.now()) {
            localStorage.removeItem(STORAGE_KEY)
            setIsLoggedIn(false)
            return null
        }
        return tokenData.access_token
    }, [])

    const login = useCallback(() => {
        if (tokenClient) {
            tokenClient.requestAccessToken({ prompt: '' })
        }
    }, [tokenClient])

    const logout = useCallback(() => {
        const token = getAccessToken()
        if (token) {
            window.google?.accounts?.oauth2?.revoke(token)
        }
        localStorage.removeItem(STORAGE_KEY)
        setIsLoggedIn(false)
    }, [getAccessToken])

    // API helper
    const apiRequest = useCallback(async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
        const token = getAccessToken()
        if (!token) {
            throw new Error('Not authenticated')
        }

        const response = await fetch(`https://tasks.googleapis.com/tasks/v1${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        })

        if (!response.ok) {
            if (response.status === 401) {
                logout()
                throw new Error('Session expired, please login again')
            }
            const error = await response.json().catch(() => ({})) as { error?: { message?: string } }
            throw new Error(error.error?.message || `API error: ${response.status}`)
        }

        return response.json() as Promise<T>
    }, [getAccessToken, logout])

    // Get default task list
    const getDefaultTaskList = useCallback(async (): Promise<string> => {
        const lists = await apiRequest<TaskListResponse>('/users/@me/lists')
        return lists.items?.[0]?.id || '@default'
    }, [apiRequest])

    // List pending tasks
    const listTasks = useCallback(async (): Promise<GoogleTask[]> => {
        try {
            const listId = await getDefaultTaskList()
            const result = await apiRequest<TasksResponse>(`/lists/${listId}/tasks?showCompleted=false`)
            return result.items || []
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
            return []
        }
    }, [apiRequest, getDefaultTaskList])

    // Create a new task
    const createTask = useCallback(async (title: string, entryId: string): Promise<GoogleTask> => {
        try {
            const listId = await getDefaultTaskList()
            const task = await apiRequest<GoogleTask>(`/lists/${listId}/tasks`, {
                method: 'POST',
                body: JSON.stringify({
                    title,
                    notes: `chronolog:${entryId}`,
                }),
            })
            return task
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
            throw err
        }
    }, [apiRequest, getDefaultTaskList])

    // Complete a task
    const completeTask = useCallback(async (taskId: string): Promise<GoogleTask> => {
        try {
            const listId = await getDefaultTaskList()
            const task = await apiRequest<GoogleTask>(`/lists/${listId}/tasks/${taskId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    status: 'completed',
                }),
            })
            return task
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
            throw err
        }
    }, [apiRequest, getDefaultTaskList])

    // Delete a task
    const deleteTask = useCallback(async (taskId: string): Promise<void> => {
        try {
            const listId = await getDefaultTaskList()
            const token = getAccessToken()
            await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
            throw err
        }
    }, [getAccessToken, getDefaultTaskList])

    // Parse entry ID from task notes
    const parseEntryId = useCallback((task: GoogleTask): string | null => {
        if (!task.notes) return null
        const match = task.notes.match(/^chronolog:(.+)$/)
        return match ? match[1] : null
    }, [])

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
    }
}
