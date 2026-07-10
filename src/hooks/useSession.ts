import { useReducer, useEffect, useCallback, useMemo } from 'react'
import { ACTIONS } from '@/utils/constants'
import { STORAGE_KEYS, getStorage } from '@/utils/storageService'
import { SESSION_STATUS } from '@/utils/constants'
import { sessionReducer, initialState } from './sessionReducer'
import { usePersistence } from './usePersistence'
import type {
  ContentType,
  MediaItem,
  SessionState,
  UseSessionReturn,
  UpdateEntryPayload,
  ImportDataPayload,
  CategoryId
} from '@/types'

// Legacy client-side AI config keys — removed feature; purge stale data
// (chronolog_api_key held a plaintext API key in localStorage)
const LEGACY_STORAGE_KEYS = ['chronolog_api_key', 'chronolog_ai_base_url', 'chronolog_ai_model']

export function useSession(): UseSessionReturn {
  const [state, dispatch] = useReducer(sessionReducer, initialState)

  // Debounced localStorage persistence
  usePersistence(state)

  // Load saved state on mount
  useEffect(() => {
    const savedState = getStorage<Partial<SessionState>>(STORAGE_KEYS.STATE)

    if (savedState) {
      dispatch({ type: ACTIONS.LOAD_STATE, payload: savedState })
    }

    LEGACY_STORAGE_KEYS.forEach(key => localStorage.removeItem(key))
  }, [])

  // --- Actions ---

  const logIn = useCallback((content: string, options?: { contentType?: string; fieldValues?: Record<string, unknown>; category?: CategoryId; tags?: string[] }) => {
    dispatch({
      type: ACTIONS.LOG_IN,
      payload: {
        content,
        contentType: options?.contentType,
        fieldValues: options?.fieldValues,
        category: options?.category,
        tags: options?.tags
      }
    })
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

  const setEntryCategory = useCallback((entryId: string, category: CategoryId) => {
    dispatch({ type: ACTIONS.SET_ENTRY_CATEGORY, payload: { entryId, category } })
  }, [])

  const updateEntry = useCallback((entryId: string, updates: Omit<UpdateEntryPayload, 'entryId'>) => {
    dispatch({ type: ACTIONS.UPDATE_ENTRY, payload: { entryId, ...updates } })
  }, [])

  const switchSession = useCallback((content: string, options?: { contentType?: string; fieldValues?: Record<string, unknown>; category?: CategoryId; tags?: string[] }) => {
    dispatch({
      type: ACTIONS.SWITCH,
      payload: {
        content,
        contentType: options?.contentType,
        fieldValues: options?.fieldValues,
        category: options?.category,
        tags: options?.tags
      }
    })
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

  // Memoize the actions object so consumers don't re-render when state changes.
  // All individual functions are useCallback with [] deps, so this memo is stable.
  const actions = useMemo(() => ({
    logIn,
    switchSession,
    addNote,
    logOff,
    deleteEntry,
    editEntry,
    setEntryCategory,
    updateEntry,
    importData,
    addContentType,
    updateContentType,
    deleteContentType,
    addMediaItem,
    updateMediaItem,
    deleteMediaItem
  }), [
    logIn, switchSession, addNote, logOff, deleteEntry, editEntry,
    setEntryCategory, updateEntry, importData,
    addContentType, updateContentType, deleteContentType,
    addMediaItem, updateMediaItem, deleteMediaItem
  ])

  return {
    state,
    isStreaming: state.status === SESSION_STATUS.STREAMING,
    actions
  }
}
