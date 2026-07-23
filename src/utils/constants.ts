import type { SessionStatus } from '@/types'
export { BUILTIN_CONTENT_TYPES } from '@/features/contentTypes/definitions'

// Fixed categories live in ./categories.ts (shared with Pages Functions); re-exported for convenience
export { CATEGORIES } from './categories'

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
  DELETE_NOTE: 'DELETE_NOTE',
  DELETE_SESSION: 'DELETE_SESSION',
  UPDATE_NOTE: 'UPDATE_NOTE',
  UPDATE_SESSION: 'UPDATE_SESSION',
  LOAD_STATE: 'LOAD_STATE',
  IMPORT_DATA: 'IMPORT_DATA',
  ADD_MEDIA_ITEM: 'ADD_MEDIA_ITEM',
  UPDATE_MEDIA_ITEM: 'UPDATE_MEDIA_ITEM',
  DELETE_MEDIA_ITEM: 'DELETE_MEDIA_ITEM',
} as const
