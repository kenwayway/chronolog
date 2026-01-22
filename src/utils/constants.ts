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


// Fixed categories (life areas for time tracking, not user-editable)
export const CATEGORIES: Category[] = [
  { id: 'hustle', label: 'Hustle', color: '#7aa2f7', description: 'Life admin: visa, taxes, rent, bills, errands, paperwork' },
  { id: 'craft', label: 'Craft', color: '#bb9af7', description: 'Coding, drawing, creating, building projects' },
  { id: 'hardware', label: 'Hardware', color: '#4dcc59', description: 'Sleep, eating, workout, physical health, mental health' },
  { id: 'barter', label: 'Barter', color: '#c8e068', description: 'Friends, social activities, relationships' },
  { id: 'wander', label: 'Wander', color: '#f7768e', description: 'Travel, movies, relaxation, exploration' },
  { id: 'work', label: 'Work', color: '#f59e0b', description: 'Job tasks, meetings, work projects, office stuff' },
]

// Built-in content types (user can't delete, but can edit fields/options)
export const BUILTIN_CONTENT_TYPES: ContentType[] = [
  {
    id: 'note',
    name: 'Note',
    fields: [],
    builtIn: true,
    order: 0
  },
  {
    id: 'task',
    name: 'Task',
    fields: [
      { id: 'done', name: 'Done', type: 'boolean', default: false }
    ],
    builtIn: true,
    order: 1
  },
  {
    id: 'bookmark',
    name: 'Bookmark',
    fields: [
      { id: 'url', name: 'URL', type: 'text' },
      { id: 'title', name: 'Title', type: 'text' },
      { id: 'type', name: 'Type', type: 'dropdown', options: ['Article', 'Video', 'Tool', 'Paper'], default: 'Article' },
      { id: 'status', name: 'Status', type: 'dropdown', options: ['Inbox', 'Reading', 'Archived'], default: 'Inbox' }
    ],
    builtIn: true,
    order: 2
  },
  {
    id: 'mood',
    name: 'Mood',
    fields: [
      { id: 'feeling', name: 'Feeling', type: 'dropdown', options: ['Happy', 'Excited', 'Calm', 'Tired', 'Anxious', 'Sad', 'Angry'], default: 'Calm' },
      { id: 'energy', name: 'Energy', type: 'number', default: 3 },
      { id: 'trigger', name: 'Trigger', type: 'dropdown', options: ['Work', 'Health', 'Social', 'Money', 'Family', 'Sleep', 'Weather', 'Other'] }
    ],
    builtIn: true,
    order: 3
  },
  {
    id: 'workout',
    name: 'Workout',
    fields: [
      { id: 'workoutType', name: 'Type', type: 'dropdown', options: ['Strength', 'Flexibility', 'Mixed'], default: 'Strength' },
      { id: 'duration', name: 'Duration (min)', type: 'number' },
      { id: 'exercises', name: 'Exercises', type: 'text' } // Will be JSON string of exercise array
    ],
    builtIn: true,
    order: 4
  },
  {
    id: 'beans',
    name: 'Beans',
    fields: [],
    builtIn: true,
    order: 5
  },
  {
    id: 'sparks',
    name: 'Sparks',
    fields: [],
    builtIn: true,
    order: 6
  }
]

