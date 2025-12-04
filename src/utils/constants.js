// Entry types for the timeline
export const ENTRY_TYPES = {
    SESSION_START: 'SESSION_START',  // LOG IN
    NOTE: 'NOTE',                    // Mid-session note
    SESSION_END: 'SESSION_END',      // LOG OFF (includes duration)
    TASK_DONE: 'TASK_DONE'           // Completed task (time-jumped)
}

// Session states
export const SESSION_STATUS = {
    IDLE: 'IDLE',
    STREAMING: 'STREAMING'
}

// Action types for reducer
export const ACTIONS = {
    LOG_IN: 'LOG_IN',
    SWITCH: 'SWITCH',  // End current session and start new one
    NOTE: 'NOTE',
    LOG_OFF: 'LOG_OFF',
    COMPLETE_TASK: 'COMPLETE_TASK',
    DELETE_ENTRY: 'DELETE_ENTRY',
    EDIT_ENTRY: 'EDIT_ENTRY',
    LOAD_STATE: 'LOAD_STATE',
    SET_API_KEY: 'SET_API_KEY',
    ADD_TASK: 'ADD_TASK',
    SET_CATEGORIES: 'SET_CATEGORIES',
    SET_ENTRY_CATEGORY: 'SET_ENTRY_CATEGORY'
}

// Storage keys
export const STORAGE_KEYS = {
    STATE: 'chronolog_state',
    API_KEY: 'chronolog_api_key',
    CATEGORIES: 'chronolog_categories'
}

// Default categories
export const DEFAULT_CATEGORIES = [
    { id: 'work', label: 'Work', color: '#7aa2f7' },
    { id: 'craft', label: 'Craft', color: '#bb9af7' },
    { id: 'maintenance', label: 'Maintenance', color: '#9ece6a' },
    { id: 'explore', label: 'Explore', color: '#e0af68' },
    { id: 'learning', label: 'Learning', color: '#89ddff' },
]
