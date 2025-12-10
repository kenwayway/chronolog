import { useReducer, useEffect, useCallback } from 'react'
import { ENTRY_TYPES, SESSION_STATUS, ACTIONS, STORAGE_KEYS } from '../utils/constants'
import { generateId } from '../utils/formatters'
import type {
    Entry,
    SessionState,
    SessionAction,
    UseSessionReturn,
    SetAIConfigPayload,
    UpdateEntryPayload,
    ImportDataPayload,
    CategoryId
} from '../types'

// Initial state
const initialState: SessionState = {
    status: SESSION_STATUS.IDLE,
    sessionStart: null,
    entries: [],
    apiKey: null,
    aiBaseUrl: 'https://api.openai.com/v1',
    aiModel: 'gpt-4o-mini'
}

// Reducer function
function sessionReducer(state: SessionState, action: SessionAction): SessionState {
    switch (action.type) {
        case ACTIONS.LOG_IN: {
            const newEntry: Entry = {
                id: generateId(),
                type: ENTRY_TYPES.SESSION_START,
                content: action.payload.content,
                timestamp: Date.now(),
                sessionId: generateId()
            }
            return {
                ...state,
                status: SESSION_STATUS.STREAMING,
                sessionStart: newEntry.timestamp,
                entries: [...state.entries, newEntry]
            }
        }

        case ACTIONS.SWITCH: {
            const now = Date.now()
            const newSessionId = generateId()
            let newEntries = [...state.entries]

            if (state.status === SESSION_STATUS.STREAMING && state.sessionStart) {
                const endEntry: Entry = {
                    id: generateId(),
                    type: ENTRY_TYPES.SESSION_END,
                    content: '',
                    timestamp: now,
                    duration: now - state.sessionStart
                }
                newEntries.push(endEntry)
            }

            const startEntry: Entry = {
                id: generateId(),
                type: ENTRY_TYPES.SESSION_START,
                content: action.payload.content,
                timestamp: now + 1,
                sessionId: newSessionId
            }
            newEntries.push(startEntry)

            return {
                ...state,
                status: SESSION_STATUS.STREAMING,
                sessionStart: startEntry.timestamp,
                entries: newEntries
            }
        }

        case ACTIONS.NOTE: {
            const newEntry: Entry = {
                id: generateId(),
                type: ENTRY_TYPES.NOTE,
                content: action.payload.content,
                timestamp: Date.now()
            }

            return {
                ...state,
                entries: [...state.entries, newEntry]
            }
        }

        case ACTIONS.LOG_OFF: {
            if (state.status !== SESSION_STATUS.STREAMING) {
                console.warn('Cannot log off when not streaming')
                return state
            }
            const duration = Date.now() - (state.sessionStart ?? 0)
            const newEntry: Entry = {
                id: generateId(),
                type: ENTRY_TYPES.SESSION_END,
                content: action.payload?.content || '',
                timestamp: Date.now(),
                duration
            }
            return {
                ...state,
                status: SESSION_STATUS.IDLE,
                sessionStart: null,
                entries: [...state.entries, newEntry]
            }
        }

        case ACTIONS.COMPLETE_TASK: {
            const { entryId, content } = action.payload

            const doneEntry: Entry = {
                id: generateId(),
                type: ENTRY_TYPES.TASK_DONE,
                content: content || '',
                timestamp: Date.now()
            }

            let newEntries = [...state.entries, doneEntry]
            if (entryId) {
                newEntries = state.entries.filter(e => e.id !== entryId).concat(doneEntry)
            }

            return {
                ...state,
                entries: newEntries
            }
        }

        case ACTIONS.DELETE_ENTRY: {
            const entryId = action.payload.entryId
            return {
                ...state,
                entries: state.entries.filter(e => e.id !== entryId)
            }
        }

        case ACTIONS.EDIT_ENTRY: {
            const { entryId, content } = action.payload
            return {
                ...state,
                entries: state.entries.map(e =>
                    e.id === entryId ? { ...e, content } : e
                )
            }
        }

        case ACTIONS.LOAD_STATE: {
            return {
                ...initialState,
                ...action.payload,
                apiKey: state.apiKey ?? action.payload.apiKey ?? initialState.apiKey,
                aiBaseUrl: state.aiBaseUrl ?? action.payload.aiBaseUrl ?? initialState.aiBaseUrl,
                aiModel: state.aiModel ?? action.payload.aiModel ?? initialState.aiModel,
                status: action.payload.sessionStart ? SESSION_STATUS.STREAMING : SESSION_STATUS.IDLE
            }
        }

        case ACTIONS.SET_API_KEY: {
            return {
                ...state,
                apiKey: action.payload.apiKey
            }
        }

        case ACTIONS.SET_AI_CONFIG: {
            return {
                ...state,
                apiKey: action.payload.apiKey ?? state.apiKey,
                aiBaseUrl: action.payload.aiBaseUrl ?? state.aiBaseUrl,
                aiModel: action.payload.aiModel ?? state.aiModel
            }
        }

        case ACTIONS.SET_ENTRY_CATEGORY: {
            const { entryId, category } = action.payload
            return {
                ...state,
                entries: state.entries.map(e =>
                    e.id === entryId ? { ...e, category } : e
                )
            }
        }

        case ACTIONS.MARK_AS_TASK: {
            const { entryId } = action.payload
            const entry = state.entries.find(e => e.id === entryId)
            if (!entry || entry.type === ENTRY_TYPES.TASK || entry.type === ENTRY_TYPES.TASK_DONE) {
                return state
            }

            return {
                ...state,
                entries: state.entries.map(e =>
                    e.id === entryId ? { ...e, type: ENTRY_TYPES.TASK } : e
                )
            }
        }

        case ACTIONS.UPDATE_ENTRY: {
            const { entryId, content, timestamp, category } = action.payload
            return {
                ...state,
                entries: state.entries.map(e => {
                    if (e.id !== entryId) return e
                    const updated = { ...e }
                    if (content !== undefined) updated.content = content
                    if (timestamp !== undefined) updated.timestamp = timestamp
                    if (category !== undefined) updated.category = category
                    return updated
                })
            }
        }

        case ACTIONS.IMPORT_DATA: {
            const importedEntries = action.payload.entries || []

            let inSession = false
            let lastSessionStart: number | null = null

            for (const entry of importedEntries) {
                if (entry.type === ENTRY_TYPES.SESSION_START) {
                    inSession = true
                    lastSessionStart = entry.timestamp
                } else if (entry.type === ENTRY_TYPES.SESSION_END) {
                    inSession = false
                    lastSessionStart = null
                }
            }

            return {
                ...state,
                entries: importedEntries,
                status: inSession ? SESSION_STATUS.STREAMING : SESSION_STATUS.IDLE,
                sessionStart: lastSessionStart
            }
        }

        default:
            return state
    }
}

export function useSession(): UseSessionReturn {
    const [state, dispatch] = useReducer(sessionReducer, initialState)

    useEffect(() => {
        const savedState = localStorage.getItem(STORAGE_KEYS.STATE)
        const savedApiKey = localStorage.getItem(STORAGE_KEYS.API_KEY)
        const savedBaseUrl = localStorage.getItem(STORAGE_KEYS.AI_BASE_URL)
        const savedModel = localStorage.getItem(STORAGE_KEYS.AI_MODEL)

        if (savedState) {
            try {
                const parsed = JSON.parse(savedState)
                dispatch({ type: ACTIONS.LOAD_STATE, payload: parsed })
            } catch (e) {
                console.error('Failed to parse saved state:', e)
            }
        }

        if (savedApiKey || savedBaseUrl || savedModel) {
            dispatch({
                type: ACTIONS.SET_AI_CONFIG,
                payload: {
                    apiKey: savedApiKey || undefined,
                    aiBaseUrl: savedBaseUrl || 'https://api.openai.com/v1',
                    aiModel: savedModel || 'gpt-4o-mini'
                }
            })
        }
    }, [])

    useEffect(() => {
        const stateToSave = {
            status: state.status,
            sessionStart: state.sessionStart,
            entries: state.entries
        }
        localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(stateToSave))
    }, [state.status, state.sessionStart, state.entries])

    const logIn = useCallback((content: string) => {
        dispatch({ type: ACTIONS.LOG_IN, payload: { content } })
    }, [])

    const addNote = useCallback((content: string) => {
        dispatch({ type: ACTIONS.NOTE, payload: { content } })
    }, [])

    const logOff = useCallback((content: string = '') => {
        dispatch({ type: ACTIONS.LOG_OFF, payload: { content } })
    }, [])

    const completeTask = useCallback((entryId: string | undefined, content: string) => {
        dispatch({ type: ACTIONS.COMPLETE_TASK, payload: { entryId, content } })
    }, [])

    const deleteEntry = useCallback((entryId: string) => {
        dispatch({ type: ACTIONS.DELETE_ENTRY, payload: { entryId } })
    }, [])

    const editEntry = useCallback((entryId: string, content: string) => {
        dispatch({ type: ACTIONS.EDIT_ENTRY, payload: { entryId, content } })
    }, [])

    const setApiKey = useCallback((apiKey: string) => {
        localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey)
        dispatch({ type: ACTIONS.SET_API_KEY, payload: { apiKey } })
    }, [])

    const setAIConfig = useCallback((config: SetAIConfigPayload) => {
        const { apiKey, aiBaseUrl, aiModel } = config
        if (apiKey !== undefined) localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey)
        if (aiBaseUrl !== undefined) localStorage.setItem(STORAGE_KEYS.AI_BASE_URL, aiBaseUrl)
        if (aiModel !== undefined) localStorage.setItem(STORAGE_KEYS.AI_MODEL, aiModel)
        dispatch({ type: ACTIONS.SET_AI_CONFIG, payload: config })
    }, [])

    const setEntryCategory = useCallback((entryId: string, category: CategoryId) => {
        dispatch({ type: ACTIONS.SET_ENTRY_CATEGORY, payload: { entryId, category } })
    }, [])

    const markAsTask = useCallback((entryId: string) => {
        dispatch({ type: ACTIONS.MARK_AS_TASK, payload: { entryId } })
    }, [])

    const updateEntry = useCallback((entryId: string, updates: Omit<UpdateEntryPayload, 'entryId'>) => {
        dispatch({ type: ACTIONS.UPDATE_ENTRY, payload: { entryId, ...updates } })
    }, [])

    const switchSession = useCallback((content: string) => {
        dispatch({ type: ACTIONS.SWITCH, payload: { content } })
    }, [])

    const importData = useCallback((data: ImportDataPayload) => {
        dispatch({ type: ACTIONS.IMPORT_DATA, payload: data })
    }, [])

    return {
        state,
        isStreaming: state.status === SESSION_STATUS.STREAMING,
        actions: {
            logIn,
            switchSession,
            addNote,
            logOff,
            completeTask,
            deleteEntry,
            editEntry,
            setApiKey,
            setAIConfig,
            setEntryCategory,
            markAsTask,
            updateEntry,
            importData
        }
    }
}
