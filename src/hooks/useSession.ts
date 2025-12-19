import { useReducer, useEffect, useCallback } from 'react'
import { ENTRY_TYPES, SESSION_STATUS, ACTIONS, BUILTIN_CONTENT_TYPES } from '../utils/constants'
import { STORAGE_KEYS, getStorage, getStorageRaw, setStorage, setStorageRaw } from '../utils/storageService'
import { generateId } from '../utils/formatters'
import { parseTags } from '../utils/tagParser'
import type {
  Entry,
  ContentType,
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
  contentTypes: [...BUILTIN_CONTENT_TYPES],
  apiKey: null,
  aiBaseUrl: 'https://api.openai.com/v1',
  aiModel: 'gpt-4o-mini'
}

// Reducer function
function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case ACTIONS.LOG_IN: {
      const { cleanContent, tags } = parseTags(action.payload.content);
      const newEntry: Entry = {
        id: generateId(),
        type: ENTRY_TYPES.SESSION_START,
        content: cleanContent,
        timestamp: Date.now(),
        sessionId: generateId(),
        tags: tags.length > 0 ? tags : undefined
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

      // Add session end entry
      if (state.status === SESSION_STATUS.STREAMING) {
        const duration = now - (state.sessionStart ?? 0)
        const endEntry: Entry = {
          id: generateId(),
          type: ENTRY_TYPES.SESSION_END,
          content: '',
          timestamp: now,
          duration
        }
        newEntries.push(endEntry)
      }

      // Add new session start entry
      const { cleanContent, tags } = parseTags(action.payload.content);
      const startEntry: Entry = {
        id: generateId(),
        type: ENTRY_TYPES.SESSION_START,
        content: cleanContent,
        timestamp: now,
        sessionId: newSessionId,
        tags: tags.length > 0 ? tags : undefined
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
      const { cleanContent, tags: parsedTags } = parseTags(action.payload.content);
      // Use manually provided tags if present, otherwise use parsed tags from content
      const finalTags = action.payload.tags && action.payload.tags.length > 0
        ? action.payload.tags
        : (parsedTags.length > 0 ? parsedTags : undefined);
      const newEntry: Entry = {
        id: generateId(),
        type: ENTRY_TYPES.NOTE,
        content: cleanContent,
        timestamp: Date.now(),
        contentType: action.payload.contentType,
        fieldValues: action.payload.fieldValues,
        category: action.payload.category,
        tags: finalTags
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
      const originalContent = action.payload?.content || 'Session ended';
      const { cleanContent, tags } = parseTags(originalContent);
      const newEntry: Entry = {
        id: generateId(),
        type: ENTRY_TYPES.SESSION_END,
        content: cleanContent,
        timestamp: Date.now(),
        duration,
        tags: tags.length > 0 ? tags : undefined
      }
      return {
        ...state,
        status: SESSION_STATUS.IDLE,
        sessionStart: null,
        entries: [...state.entries, newEntry]
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
      // Merge built-in content types with loaded ones
      const loadedContentTypes = action.payload.contentTypes || []
      const builtInIds = BUILTIN_CONTENT_TYPES.map(ct => ct.id)

      // Use loaded versions of built-in types (user may have edited fields)
      // Add any custom types the user created
      const mergedContentTypes = [
        ...BUILTIN_CONTENT_TYPES.map(builtIn => {
          const loaded = loadedContentTypes.find(ct => ct.id === builtIn.id)
          return loaded ? { ...loaded, builtIn: true } : builtIn
        }),
        ...loadedContentTypes.filter(ct => !builtInIds.includes(ct.id))
      ]

      return {
        ...initialState,
        ...action.payload,
        contentTypes: mergedContentTypes,
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

    case ACTIONS.UPDATE_ENTRY: {
      const { entryId, content, timestamp, category, contentType, fieldValues, linkedEntries, tags, type, aiComment } = action.payload
      return {
        ...state,
        entries: state.entries.map(e => {
          if (e.id !== entryId) return e
          const updated = { ...e }
          if (content !== undefined) updated.content = content
          if (timestamp !== undefined) updated.timestamp = timestamp
          if (category !== undefined) updated.category = category
          if (contentType !== undefined) updated.contentType = contentType
          if (fieldValues !== undefined) updated.fieldValues = fieldValues
          if (linkedEntries !== undefined) updated.linkedEntries = linkedEntries
          if (tags !== undefined) updated.tags = tags.length > 0 ? tags : undefined
          if (type !== undefined) updated.type = type
          if (aiComment !== undefined) updated.aiComment = aiComment
          return updated
        })
      }
    }

    case ACTIONS.IMPORT_DATA: {
      const importedEntries = action.payload.entries || []
      const importedContentTypes = action.payload.contentTypes || []

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

      // Merge content types
      const builtInIds = BUILTIN_CONTENT_TYPES.map(ct => ct.id)
      const mergedContentTypes = [
        ...BUILTIN_CONTENT_TYPES.map(builtIn => {
          const imported = importedContentTypes.find(ct => ct.id === builtIn.id)
          return imported ? { ...imported, builtIn: true } : builtIn
        }),
        ...importedContentTypes.filter(ct => !builtInIds.includes(ct.id))
      ]

      return {
        ...state,
        entries: importedEntries,
        contentTypes: mergedContentTypes.length > 0 ? mergedContentTypes : state.contentTypes,
        status: inSession ? SESSION_STATUS.STREAMING : SESSION_STATUS.IDLE,
        sessionStart: lastSessionStart
      }
    }

    case ACTIONS.ADD_CONTENT_TYPE: {
      const newType = action.payload.contentType
      // Ensure unique ID and set order
      const maxOrder = Math.max(...state.contentTypes.map(ct => ct.order ?? 0), 0)
      return {
        ...state,
        contentTypes: [...state.contentTypes, { ...newType, order: maxOrder + 1 }]
      }
    }

    case ACTIONS.UPDATE_CONTENT_TYPE: {
      const { id, updates } = action.payload
      return {
        ...state,
        contentTypes: state.contentTypes.map(ct =>
          ct.id === id ? { ...ct, ...updates } : ct
        )
      }
    }

    case ACTIONS.DELETE_CONTENT_TYPE: {
      const { id } = action.payload
      const typeToDelete = state.contentTypes.find(ct => ct.id === id)
      // Can't delete built-in types
      if (typeToDelete?.builtIn) {
        console.warn('Cannot delete built-in content type')
        return state
      }
      return {
        ...state,
        contentTypes: state.contentTypes.filter(ct => ct.id !== id)
      }
    }

    default:
      return state
  }
}

export function useSession(): UseSessionReturn {
  const [state, dispatch] = useReducer(sessionReducer, initialState)

  useEffect(() => {
    const savedState = getStorage<Partial<SessionState>>(STORAGE_KEYS.STATE)
    const savedApiKey = getStorageRaw(STORAGE_KEYS.API_KEY)
    const savedBaseUrl = getStorageRaw(STORAGE_KEYS.AI_BASE_URL)
    const savedModel = getStorageRaw(STORAGE_KEYS.AI_MODEL)

    if (savedState) {
      dispatch({ type: ACTIONS.LOAD_STATE, payload: savedState })
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
      entries: state.entries,
      contentTypes: state.contentTypes
    }
    setStorage(STORAGE_KEYS.STATE, stateToSave)
  }, [state.status, state.sessionStart, state.entries, state.contentTypes])

  const logIn = useCallback((content: string) => {
    dispatch({ type: ACTIONS.LOG_IN, payload: { content } })
  }, [])

  const addNote = useCallback((content: string, options?: { contentType?: string; fieldValues?: Record<string, unknown>; category?: CategoryId; tags?: string[] }) => {
    dispatch({
      type: ACTIONS.NOTE,
      payload: {
        content,
        contentType: options?.contentType,
        fieldValues: options?.fieldValues,
        category: options?.category,
        tags: options?.tags
      }
    })
  }, [])

  const logOff = useCallback((content: string = '') => {
    dispatch({ type: ACTIONS.LOG_OFF, payload: { content } })
  }, [])

  const deleteEntry = useCallback((entryId: string) => {
    dispatch({ type: ACTIONS.DELETE_ENTRY, payload: { entryId } })
  }, [])

  const editEntry = useCallback((entryId: string, content: string) => {
    dispatch({ type: ACTIONS.EDIT_ENTRY, payload: { entryId, content } })
  }, [])

  const setApiKey = useCallback((apiKey: string) => {
    setStorageRaw(STORAGE_KEYS.API_KEY, apiKey)
    dispatch({ type: ACTIONS.SET_API_KEY, payload: { apiKey } })
  }, [])

  const setAIConfig = useCallback((config: SetAIConfigPayload) => {
    const { apiKey, aiBaseUrl, aiModel } = config
    if (apiKey !== undefined) setStorageRaw(STORAGE_KEYS.API_KEY, apiKey)
    if (aiBaseUrl !== undefined) setStorageRaw(STORAGE_KEYS.AI_BASE_URL, aiBaseUrl)
    if (aiModel !== undefined) setStorageRaw(STORAGE_KEYS.AI_MODEL, aiModel)
    dispatch({ type: ACTIONS.SET_AI_CONFIG, payload: config })
  }, [])

  const setEntryCategory = useCallback((entryId: string, category: CategoryId) => {
    dispatch({ type: ACTIONS.SET_ENTRY_CATEGORY, payload: { entryId, category } })
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

  const addContentType = useCallback((contentType: ContentType) => {
    dispatch({ type: ACTIONS.ADD_CONTENT_TYPE, payload: { contentType } })
  }, [])

  const updateContentType = useCallback((id: string, updates: Partial<Omit<ContentType, 'id' | 'builtIn'>>) => {
    dispatch({ type: ACTIONS.UPDATE_CONTENT_TYPE, payload: { id, updates } })
  }, [])

  const deleteContentType = useCallback((id: string) => {
    dispatch({ type: ACTIONS.DELETE_CONTENT_TYPE, payload: { id } })
  }, [])

  return {
    state,
    isStreaming: state.status === SESSION_STATUS.STREAMING,
    actions: {
      logIn,
      switchSession,
      addNote,
      logOff,
      deleteEntry,
      editEntry,
      setApiKey,
      setAIConfig,
      setEntryCategory,
      updateEntry,
      importData,
      addContentType,
      updateContentType,
      deleteContentType
    }
  }
}
