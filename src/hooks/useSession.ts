import { useReducer, useEffect, useCallback } from 'react'
import { ACTIONS } from '../utils/constants'
import { STORAGE_KEYS, getStorage, getStorageRaw, setStorageRaw } from '../utils/storageService'
import { SESSION_STATUS } from '../utils/constants'
import { sessionReducer, initialState } from './sessionReducer'
import { usePersistence } from './usePersistence'
import type {
  ContentType,
  MediaItem,
  SessionState,
  UseSessionReturn,
  SetAIConfigPayload,
  UpdateEntryPayload,
  ImportDataPayload,
  CategoryId
} from '../types'

export function useSession(): UseSessionReturn {
  const [state, dispatch] = useReducer(sessionReducer, initialState)

  // Debounced localStorage persistence
  usePersistence(state)

  // Load saved state on mount
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

  // --- Actions ---

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

  const addMediaItem = useCallback((mediaItem: MediaItem) => {
    dispatch({ type: ACTIONS.ADD_MEDIA_ITEM, payload: { mediaItem } })
  }, [])

  const updateMediaItem = useCallback((id: string, updates: Partial<Omit<MediaItem, 'id' | 'createdAt'>>) => {
    dispatch({ type: ACTIONS.UPDATE_MEDIA_ITEM, payload: { id, updates } })
  }, [])

  const deleteMediaItem = useCallback((id: string) => {
    dispatch({ type: ACTIONS.DELETE_MEDIA_ITEM, payload: { id } })
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
      deleteContentType,
      addMediaItem,
      updateMediaItem,
      deleteMediaItem
    }
  }
}
