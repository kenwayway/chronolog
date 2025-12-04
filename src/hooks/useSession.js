import { useReducer, useEffect, useCallback } from 'react'
import { ENTRY_TYPES, SESSION_STATUS, ACTIONS, STORAGE_KEYS } from '../utils/constants'
import { generateId } from '../utils/formatters'

// Default test data
const now = Date.now()
const defaultTestData = {
    status: SESSION_STATUS.IDLE,
    sessionStart: null,
    entries: [
        // Session 1: Morning work
        {
            id: 'test-1',
            type: ENTRY_TYPES.SESSION_START,
            content: '开始写代码',
            timestamp: now - 4 * 60 * 60 * 1000, // 4 hours ago
        },
        {
            id: 'test-2',
            type: ENTRY_TYPES.NOTE,
            content: '想到一个好的架构方案',
            timestamp: now - 3.5 * 60 * 60 * 1000,
            isTodo: false,
        },
        {
            id: 'test-3',
            type: ENTRY_TYPES.NOTE,
            content: '需要买咖啡豆',
            timestamp: now - 3 * 60 * 60 * 1000,
            isTodo: true,
            taskId: 'task-1',
        },
        {
            id: 'test-4',
            type: ENTRY_TYPES.SESSION_END,
            content: '',
            timestamp: now - 2.5 * 60 * 60 * 1000,
            duration: 1.5 * 60 * 60 * 1000, // 1.5 hours
        },
        // Standalone note
        {
            id: 'test-5',
            type: ENTRY_TYPES.NOTE,
            content: '午休时想到的灵感',
            timestamp: now - 2 * 60 * 60 * 1000,
            isTodo: false,
        },
        // Session 2: Afternoon work
        {
            id: 'test-6',
            type: ENTRY_TYPES.SESSION_START,
            content: '继续开发功能',
            timestamp: now - 1.5 * 60 * 60 * 1000,
        },
        {
            id: 'test-7',
            type: ENTRY_TYPES.NOTE,
            content: '记得给设计师反馈',
            timestamp: now - 1 * 60 * 60 * 1000,
            isTodo: true,
            taskId: 'task-2',
        },
        {
            id: 'test-8',
            type: ENTRY_TYPES.SESSION_END,
            content: '完成了主要功能',
            timestamp: now - 0.5 * 60 * 60 * 1000,
            duration: 1 * 60 * 60 * 1000, // 1 hour
        },
    ],
    tasks: [
        {
            id: 'task-1',
            content: '需要买咖啡豆',
            createdAt: now - 3 * 60 * 60 * 1000,
            entryId: 'test-3',
            done: false,
        },
        {
            id: 'task-2',
            content: '记得给设计师反馈',
            createdAt: now - 1 * 60 * 60 * 1000,
            entryId: 'test-7',
            done: false,
        },
    ],
    apiKey: null
}

// Initial state
const initialState = {
    status: SESSION_STATUS.IDLE,
    sessionStart: null,
    entries: [],
    tasks: [],
    apiKey: null
}

// Reducer function
function sessionReducer(state, action) {
    switch (action.type) {
        case ACTIONS.LOG_IN: {
            const newEntry = {
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

        case ACTIONS.NOTE: {
            // Allow NOTE in any state (both IDLE and STREAMING)
            const newEntry = {
                id: generateId(),
                type: ENTRY_TYPES.NOTE,
                content: action.payload.content,
                timestamp: Date.now(),
                isTodo: action.payload.isTodo || false,
                taskId: action.payload.taskId || null
            }

            let newTasks = state.tasks
            if (action.payload.isTodo) {
                const taskId = generateId()
                newTasks = [...state.tasks, {
                    id: taskId,
                    content: action.payload.taskDescription || action.payload.content,
                    createdAt: newEntry.timestamp,
                    entryId: newEntry.id,
                    done: false
                }]
                newEntry.taskId = taskId
            }

            return {
                ...state,
                entries: [...state.entries, newEntry],
                tasks: newTasks
            }
        }

        case ACTIONS.LOG_OFF: {
            if (state.status !== SESSION_STATUS.STREAMING) {
                console.warn('Cannot log off when not streaming')
                return state
            }
            const duration = Date.now() - state.sessionStart
            const newEntry = {
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

        case ACTIONS.ADD_TASK: {
            const taskId = generateId()
            const newEntry = {
                id: generateId(),
                type: ENTRY_TYPES.NOTE,
                content: action.payload.content,
                timestamp: Date.now(),
                isTodo: true,
                taskId
            }
            const newTask = {
                id: taskId,
                content: action.payload.taskDescription || action.payload.content,
                createdAt: newEntry.timestamp,
                entryId: newEntry.id,
                done: false
            }
            return {
                ...state,
                entries: [...state.entries, newEntry],
                tasks: [...state.tasks, newTask]
            }
        }

        case ACTIONS.COMPLETE_TASK: {
            const taskId = action.payload.taskId
            const task = state.tasks.find(t => t.id === taskId)
            if (!task) return state

            const doneEntry = {
                id: generateId(),
                type: ENTRY_TYPES.TASK_DONE,
                content: task.content,
                timestamp: Date.now(),
                originalTaskId: taskId,
                originalCreatedAt: task.createdAt
            }

            const updatedTasks = state.tasks.map(t =>
                t.id === taskId ? { ...t, done: true, completedAt: Date.now() } : t
            )

            return {
                ...state,
                entries: [...state.entries, doneEntry],
                tasks: updatedTasks
            }
        }

        case ACTIONS.DELETE_ENTRY: {
            const entryId = action.payload.entryId
            const entry = state.entries.find(e => e.id === entryId)

            let newTasks = state.tasks
            if (entry?.taskId) {
                newTasks = state.tasks.filter(t => t.id !== entry.taskId)
            }

            return {
                ...state,
                entries: state.entries.filter(e => e.id !== entryId),
                tasks: newTasks
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
                status: action.payload.sessionStart ? SESSION_STATUS.STREAMING : SESSION_STATUS.IDLE
            }
        }

        case ACTIONS.SET_API_KEY: {
            return {
                ...state,
                apiKey: action.payload.apiKey
            }
        }

        default:
            return state
    }
}

export function useSession() {
    const [state, dispatch] = useReducer(sessionReducer, initialState)

    useEffect(() => {
        const savedState = localStorage.getItem(STORAGE_KEYS.STATE)
        const savedApiKey = localStorage.getItem(STORAGE_KEYS.API_KEY)

        if (savedState) {
            try {
                const parsed = JSON.parse(savedState)
                // Only load if there are entries, otherwise use test data
                if (parsed.entries && parsed.entries.length > 0) {
                    dispatch({ type: ACTIONS.LOAD_STATE, payload: parsed })
                } else {
                    // Load default test data
                    dispatch({ type: ACTIONS.LOAD_STATE, payload: defaultTestData })
                }
            } catch (e) {
                console.error('Failed to parse saved state:', e)
                // Load default test data on error
                dispatch({ type: ACTIONS.LOAD_STATE, payload: defaultTestData })
            }
        } else {
            // No saved state, load default test data
            dispatch({ type: ACTIONS.LOAD_STATE, payload: defaultTestData })
        }

        if (savedApiKey) {
            dispatch({ type: ACTIONS.SET_API_KEY, payload: { apiKey: savedApiKey } })
        }
    }, [])

    useEffect(() => {
        const stateToSave = {
            status: state.status,
            sessionStart: state.sessionStart,
            entries: state.entries,
            tasks: state.tasks
        }
        localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(stateToSave))
    }, [state.status, state.sessionStart, state.entries, state.tasks])

    const logIn = useCallback((content) => {
        dispatch({ type: ACTIONS.LOG_IN, payload: { content } })
    }, [])

    const addNote = useCallback((content, todoData = null) => {
        dispatch({
            type: ACTIONS.NOTE,
            payload: {
                content,
                isTodo: todoData?.isTodo || false,
                taskDescription: todoData?.taskDescription || null,
                taskId: todoData?.taskId || null
            }
        })
    }, [])

    const logOff = useCallback((content = '') => {
        dispatch({ type: ACTIONS.LOG_OFF, payload: { content } })
    }, [])

    const addTask = useCallback((content, taskDescription = null) => {
        dispatch({ type: ACTIONS.ADD_TASK, payload: { content, taskDescription } })
    }, [])

    const completeTask = useCallback((taskId) => {
        dispatch({ type: ACTIONS.COMPLETE_TASK, payload: { taskId } })
    }, [])

    const deleteEntry = useCallback((entryId) => {
        dispatch({ type: ACTIONS.DELETE_ENTRY, payload: { entryId } })
    }, [])

    const editEntry = useCallback((entryId, content) => {
        dispatch({ type: ACTIONS.EDIT_ENTRY, payload: { entryId, content } })
    }, [])

    const setApiKey = useCallback((apiKey) => {
        localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey)
        dispatch({ type: ACTIONS.SET_API_KEY, payload: { apiKey } })
    }, [])

    return {
        state,
        isStreaming: state.status === SESSION_STATUS.STREAMING,
        actions: {
            logIn,
            addNote,
            logOff,
            addTask,
            completeTask,
            deleteEntry,
            editEntry,
            setApiKey
        }
    }
}
