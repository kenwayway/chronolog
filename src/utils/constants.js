// Entry types for the timeline
export const ENTRY_TYPES = {
  SESSION_START: 'SESSION_START',  // LOG IN
  NOTE: 'NOTE',                    // Mid-session note
  SESSION_END: 'SESSION_END',      // LOG OFF (includes duration)
  TASK: 'TASK',                    // Pending task (synced with Google Tasks)
  TASK_DONE: 'TASK_DONE'           // Completed task
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
  UPDATE_ENTRY: 'UPDATE_ENTRY',  // Update content, timestamp, category
  MARK_AS_TASK: 'MARK_AS_TASK',  // Change entry type to TASK
  LOAD_STATE: 'LOAD_STATE',
  SET_API_KEY: 'SET_API_KEY',
  SET_AI_CONFIG: 'SET_AI_CONFIG',
  ADD_TASK: 'ADD_TASK',
  SET_CATEGORIES: 'SET_CATEGORIES',
  SET_ENTRY_CATEGORY: 'SET_ENTRY_CATEGORY',
  IMPORT_DATA: 'IMPORT_DATA'
}

// Storage keys
export const STORAGE_KEYS = {
  STATE: 'chronolog_state',
  API_KEY: 'chronolog_api_key',
  AI_BASE_URL: 'chronolog_ai_base_url',
  AI_MODEL: 'chronolog_ai_model',
  CATEGORIES: 'chronolog_categories'
}

// Fixed categories (not user-editable)
export const CATEGORIES = [
  { id: 'hustle', label: 'Hustle', color: '#7aa2f7' },      // Work, 赚钱
  { id: 'craft', label: 'Craft', color: '#bb9af7' },        // Coding, drawing, 创作
  { id: 'hardware', label: 'Hardware', color: '#4dcc59ff' },  // Sleep, eat, workout
  { id: 'kernel', label: 'Kernel', color: '#89ddff' },      // Learning, philosophy
  { id: 'barter', label: 'Barter', color: '#c8e068ff' },      // Friends, social
  { id: 'wonder', label: 'Wonder', color: '#f7768e' },      // 旅游, 电影, 放松
  { id: 'beans', label: 'Beans', color: '#ff9e64' },        // 小知识, TIL
]
