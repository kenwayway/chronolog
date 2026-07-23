import type { BuiltInContentTypeId, ContentType } from '@/types'

// Pure schemas stay free of React and infrastructure dependencies so reducers,
// persistence, sync, and server-facing code can consume them cheaply.
export const BUILTIN_CONTENT_TYPE_DEFINITIONS = {
  note: {
    id: 'note',
    name: 'Note',
    icon: '📝',
    fields: [],
    builtIn: true,
    order: 0,
    version: 2,
  },
  bookmark: {
    id: 'bookmark',
    name: 'Bookmark',
    icon: '🔖',
    fields: [
      { id: 'url', name: 'URL', type: 'text' },
      { id: 'title', name: 'Title', type: 'text' },
      { id: 'type', name: 'Type', type: 'dropdown', options: ['Article', 'Video', 'Tool', 'Paper'], default: 'Article' },
      { id: 'status', name: 'Status', type: 'dropdown', options: ['Inbox', 'Reading', 'Archived'], default: 'Inbox' },
    ],
    builtIn: true,
    order: 2,
    version: 2,
  },
  mood: {
    id: 'mood',
    name: 'Mood',
    icon: '🫧',
    fields: [
      { id: 'feeling', name: 'Feeling', type: 'dropdown', options: ['Happy', 'Excited', 'Calm', 'Tired', 'Anxious', 'Sad', 'Angry'], default: 'Calm' },
      { id: 'energy', name: 'Energy', type: 'number', default: 3 },
      { id: 'trigger', name: 'Trigger', type: 'dropdown', options: ['Work', 'Health', 'Social', 'Money', 'Family', 'Sleep', 'Weather', 'Other'] },
    ],
    builtIn: true,
    order: 3,
    version: 2,
  },
  workout: {
    id: 'workout',
    name: 'Workout',
    icon: '💪',
    fields: [
      { id: 'workoutType', name: 'Type', type: 'dropdown', options: ['Strength', 'Cardio', 'Flexibility', 'Mixed'], default: 'Strength' },
      { id: 'place', name: 'Place', type: 'dropdown', options: ['Home', 'In Building Gym', 'Outside Gym'] },
      { id: 'exercises', name: 'Exercises', type: 'text' },
    ],
    builtIn: true,
    order: 4,
    version: 3,
  },
  vault: {
    id: 'vault',
    name: 'Vault',
    icon: '🗄️',
    fields: [
      { id: 'title', name: 'Note Title', type: 'text' },
      { id: 'obsidianUrl', name: 'Obsidian URL', type: 'text' },
    ],
    builtIn: true,
    order: 5,
    version: 2,
  },
  beans: {
    id: 'beans',
    name: 'Beans',
    icon: '☕',
    fields: [],
    builtIn: true,
    order: 6,
    version: 2,
  },
  sparks: {
    id: 'sparks',
    name: 'Sparks',
    icon: '⚡',
    fields: [],
    builtIn: true,
    order: 7,
    version: 2,
  },
  media: {
    id: 'media',
    name: 'Media',
    icon: '🎬',
    fields: [
      { id: 'mediaId', name: 'Media', type: 'media-select' },
    ],
    builtIn: true,
    order: 8,
    version: 2,
  },
  'notion-task': {
    id: 'notion-task',
    name: 'Task',
    icon: '☑️',
    fields: [
      { id: 'notionPageId', name: 'Task URL / ID', type: 'text', required: true },
    ],
    builtIn: true,
    order: 9,
    version: 2,
  },
} satisfies Record<BuiltInContentTypeId, ContentType>

// Bump a definition's version when changing its schema so mergeContentTypes
// can replace stale synced built-ins during hydration.
export const BUILTIN_CONTENT_TYPES: ContentType[] = Object.values(
  BUILTIN_CONTENT_TYPE_DEFINITIONS,
)
