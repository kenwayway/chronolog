import type { EntryType, SessionStatus, CategoryId, Category } from '../types'

// Entry types for the timeline
export const ENTRY_TYPES = {
    SESSION_START: 'SESSION_START',
    NOTE: 'NOTE',
    SESSION_END: 'SESSION_END',
    TASK: 'TASK',
    TASK_DONE: 'TASK_DONE'
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
    COMPLETE_TASK: 'COMPLETE_TASK',
    DELETE_ENTRY: 'DELETE_ENTRY',
    EDIT_ENTRY: 'EDIT_ENTRY',
    UPDATE_ENTRY: 'UPDATE_ENTRY',
    MARK_AS_TASK: 'MARK_AS_TASK',
    LOAD_STATE: 'LOAD_STATE',
    SET_API_KEY: 'SET_API_KEY',
    SET_AI_CONFIG: 'SET_AI_CONFIG',
    SET_CATEGORIES: 'SET_CATEGORIES',
    SET_ENTRY_CATEGORY: 'SET_ENTRY_CATEGORY',
    IMPORT_DATA: 'IMPORT_DATA'
} as const

// Storage keys
export const STORAGE_KEYS = {
    STATE: 'chronolog_state',
    API_KEY: 'chronolog_api_key',
    AI_BASE_URL: 'chronolog_ai_base_url',
    AI_MODEL: 'chronolog_ai_model',
    CATEGORIES: 'chronolog_categories'
} as const

// Fixed categories (not user-editable)
export const CATEGORIES: Category[] = [
    { id: 'hustle', label: 'Hustle', color: '#7aa2f7' },
    { id: 'craft', label: 'Craft', color: '#bb9af7' },
    { id: 'hardware', label: 'Hardware', color: '#4dcc59ff' },
    { id: 'kernel', label: 'Kernel', color: '#89ddff' },
    { id: 'barter', label: 'Barter', color: '#c8e068ff' },
    { id: 'wonder', label: 'Wonder', color: '#f7768e' },
    { id: 'beans', label: 'Beans', color: '#ff9e64' },
]
