import type { EntryType, SessionStatus, CategoryId, Category, ContentType } from '../types'

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
    SET_API_KEY: 'SET_API_KEY',
    SET_AI_CONFIG: 'SET_AI_CONFIG',
    SET_ENTRY_CATEGORY: 'SET_ENTRY_CATEGORY',
    IMPORT_DATA: 'IMPORT_DATA',
    ADD_CONTENT_TYPE: 'ADD_CONTENT_TYPE',
    UPDATE_CONTENT_TYPE: 'UPDATE_CONTENT_TYPE',
    DELETE_CONTENT_TYPE: 'DELETE_CONTENT_TYPE',
} as const

// Storage keys
export const STORAGE_KEYS = {
    STATE: 'chronolog_state',
    API_KEY: 'chronolog_api_key',
    AI_BASE_URL: 'chronolog_ai_base_url',
    AI_MODEL: 'chronolog_ai_model',
} as const

// Fixed categories (life areas, not user-editable)
export const CATEGORIES: Category[] = [
    { id: 'hustle', label: 'Hustle', color: '#7aa2f7' },
    { id: 'craft', label: 'Craft', color: '#bb9af7' },
    { id: 'hardware', label: 'Hardware', color: '#4dcc59' },
    { id: 'kernel', label: 'Kernel', color: '#89ddff' },
    { id: 'barter', label: 'Barter', color: '#c8e068' },
    { id: 'wonder', label: 'Wonder', color: '#f7768e' },
    { id: 'beans', label: 'Beans', color: '#ff9e64' },
]

// Built-in content types (user can't delete, but can edit fields/options)
export const BUILTIN_CONTENT_TYPES: ContentType[] = [
    {
        id: 'note',
        name: 'Note',
        icon: '📝',
        fields: [],
        builtIn: true,
        order: 0
    },
    {
        id: 'task',
        name: 'Task',
        icon: '☐',
        fields: [
            { id: 'done', name: 'Done', type: 'boolean', default: false }
        ],
        builtIn: true,
        order: 1
    },
    {
        id: 'expense',
        name: 'Expense',
        icon: '💰',
        fields: [
            { id: 'amount', name: 'Amount', type: 'number', required: true },
            { id: 'currency', name: 'Currency', type: 'dropdown', options: ['USD', 'CNY', 'EUR', 'GBP', 'JPY'], default: 'USD' },
            { id: 'category', name: 'Category', type: 'dropdown', options: ['Food', 'Transport', 'Entertainment', 'Shopping', 'Health', 'Bills', 'Other'] },
            { id: 'subcategory', name: 'Subcategory', type: 'text' }
        ],
        builtIn: true,
        order: 2
    }
]
