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
    NOTE: 'NOTE',
    LOG_OFF: 'LOG_OFF',
    COMPLETE_TASK: 'COMPLETE_TASK',
    DELETE_ENTRY: 'DELETE_ENTRY',
    EDIT_ENTRY: 'EDIT_ENTRY',
    LOAD_STATE: 'LOAD_STATE',
    SET_API_KEY: 'SET_API_KEY',
    ADD_TASK: 'ADD_TASK'
}

// Storage keys
export const STORAGE_KEYS = {
    STATE: 'chronolog_state',
    API_KEY: 'chronolog_api_key'
}
