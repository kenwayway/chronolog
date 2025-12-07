import { useReducer, useEffect, useCallback } from 'react'
import { ENTRY_TYPES, SESSION_STATUS, ACTIONS, STORAGE_KEYS } from '../utils/constants'
import { generateId } from '../utils/formatters'


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

    case ACTIONS.SWITCH: {
      // If already streaming, end the current session first
      const now = Date.now()
      const newSessionId = generateId()
      let newEntries = [...state.entries]

      if (state.status === SESSION_STATUS.STREAMING && state.sessionStart) {
        // Add session end entry
        const endEntry = {
          id: generateId(),
          type: ENTRY_TYPES.SESSION_END,
          content: '',
          timestamp: now,
          duration: now - state.sessionStart
        }
        newEntries.push(endEntry)
      }

      // Add session start entry
      const startEntry = {
        id: generateId(),
        type: ENTRY_TYPES.SESSION_START,
        content: action.payload.content,
        timestamp: now + 1, // +1ms to ensure order
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

    case ACTIONS.SET_ENTRY_CATEGORY: {
      const { entryId, category } = action.payload
      return {
        ...state,
        entries: state.entries.map(e =>
          e.id === entryId ? { ...e, category } : e
        )
      }
    }

    case ACTIONS.TOGGLE_TODO: {
      const { entryId } = action.payload
      const entry = state.entries.find(e => e.id === entryId)
      if (!entry || entry.type !== 'NOTE') return state

      const isNowTodo = !entry.isTodo
      let newTasks = state.tasks

      if (isNowTodo) {
        // Add to tasks
        const taskId = generateId()
        newTasks = [...state.tasks, {
          id: taskId,
          content: entry.content,
          createdAt: entry.timestamp,
          entryId: entry.id,
          done: false
        }]
        return {
          ...state,
          entries: state.entries.map(e =>
            e.id === entryId ? { ...e, isTodo: true, taskId } : e
          ),
          tasks: newTasks
        }
      } else {
        // Remove from tasks
        newTasks = state.tasks.filter(t => t.entryId !== entryId)
        return {
          ...state,
          entries: state.entries.map(e =>
            e.id === entryId ? { ...e, isTodo: false, taskId: null } : e
          ),
          tasks: newTasks
        }
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
      const { entries, tasks } = action.payload
      return {
        ...state,
        entries: entries || [],
        tasks: tasks || [],
        status: SESSION_STATUS.IDLE,
        sessionStart: null
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
        dispatch({ type: ACTIONS.LOAD_STATE, payload: parsed })
      } catch (e) {
        console.error('Failed to parse saved state:', e)
      }
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

  const setEntryCategory = useCallback((entryId, category) => {
    dispatch({ type: ACTIONS.SET_ENTRY_CATEGORY, payload: { entryId, category } })
  }, [])

  const toggleTodo = useCallback((entryId) => {
    dispatch({ type: ACTIONS.TOGGLE_TODO, payload: { entryId } })
  }, [])

  const updateEntry = useCallback((entryId, updates) => {
    dispatch({ type: ACTIONS.UPDATE_ENTRY, payload: { entryId, ...updates } })
  }, [])

  const switchSession = useCallback((content) => {
    dispatch({ type: ACTIONS.SWITCH, payload: { content } })
  }, [])

  const importData = useCallback((data) => {
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
      addTask,
      completeTask,
      deleteEntry,
      editEntry,
      setApiKey,
      setEntryCategory,
      toggleTodo,
      updateEntry,
      importData
    }
  }
}
