import type { EntryType, SessionStatus } from '@/types'
export { BUILTIN_CONTENT_TYPES } from '@/features/contentTypes/definitions'

// Fixed categories live in ./categories.ts (shared with Pages Functions); re-exported for convenience
export { CATEGORIES } from './categories'

// Entry types for the timeline (system-level)
export const ENTRY_TYPES = {
  SESSION_START: 'SESSION_START',
  NOTE: 'NOTE',
  SESSION_END: 'SESSION_END',
} as const satisfies Record<string, EntryType>

// Session states
export const SESSION_STATUS = {
  IDLE: 'IDLE',
  STREAMING: 'STREAMING'
} as const satisfies Record<string, SessionStatus>

// Action types for reducer
export const ACTIONS = {
  LOG_IN: 'LOG_IN',
  SWITCH: 'SWITCH',
  NOTE: 'NOTE',
  LOG_OFF: 'LOG_OFF',
  DELETE_ENTRY: 'DELETE_ENTRY',
  EDIT_ENTRY: 'EDIT_ENTRY',
  UPDATE_ENTRY: 'UPDATE_ENTRY',
  LOAD_STATE: 'LOAD_STATE',
  SET_ENTRY_CATEGORY: 'SET_ENTRY_CATEGORY',
  IMPORT_DATA: 'IMPORT_DATA',
  ADD_MEDIA_ITEM: 'ADD_MEDIA_ITEM',
  UPDATE_MEDIA_ITEM: 'UPDATE_MEDIA_ITEM',
  DELETE_MEDIA_ITEM: 'DELETE_MEDIA_ITEM',
} as const
