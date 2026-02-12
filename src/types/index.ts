// ============================================
// Re-exports
// ============================================
export type { CloudSyncStatus, CloudSyncWithUpload, CloudSyncFull, GoogleTasksStatus } from './cloudSync'

// ============================================
// Core Data Types
// ============================================

/** Entry type discriminator (system-level, controls session flow) */
export type EntryType = 'SESSION_START' | 'NOTE' | 'SESSION_END'

/** Session status */
export type SessionStatus = 'IDLE' | 'STREAMING'

/** Category IDs (fixed, not user-editable) - life areas for time tracking */
export type CategoryId = 'hustle' | 'craft' | 'hardware' | 'barter' | 'wander' | 'work'

/** Category definition */
export interface Category {
  id: CategoryId
  label: string
  color: string
  description: string  // Description for AI categorization
}

// ============================================
// Media Library
// ============================================

/** Media type options */
export type MediaType = 'Book' | 'Movie' | 'Game' | 'TV' | 'Anime' | 'Podcast'

/** Media item in the library */
export interface MediaItem {
  id: string              // Unique ID (uuid)
  title: string           // e.g. "Return to Silent Hill"
  mediaType: MediaType    // Book, Movie, Game, etc.
  notionUrl?: string      // Optional Notion page URL
  createdAt: number       // Timestamp when added
}

// ============================================
// ContentType System (user-editable schemas)
// ============================================

/** Field types for ContentType schema */
export type FieldType = 'text' | 'number' | 'dropdown' | 'boolean' | 'media-select'

/** Single field definition in a ContentType schema */
export interface FieldDefinition {
  id: string
  name: string
  type: FieldType
  options?: string[]    // For dropdown: user-editable options
  required?: boolean
  default?: unknown
}

/** ContentType schema (user can create/edit these) */
export interface ContentType {
  id: string
  name: string
  icon?: string         // Display icon (emoji or character)
  color?: string
  fields: FieldDefinition[]
  builtIn?: boolean     // System types can't be deleted
  order?: number        // Display order
}

// ============================================
// Built-in Content Type Field Values
// ============================================

/** Built-in content type IDs (type-safe literal union) */
export type BuiltInContentTypeId = 'note' | 'task' | 'bookmark' | 'mood' | 'workout'

/** Task field values */
export interface TaskFields {
  done: boolean
}

/** Bookmark field values */
export interface BookmarkFields {
  url?: string
  title?: string
  type?: 'Article' | 'Video' | 'Tool' | 'Paper'
  status?: 'Inbox' | 'Reading' | 'Archived'
}

/** Mood field values */
export interface MoodFields {
  feeling?: 'Happy' | 'Excited' | 'Calm' | 'Tired' | 'Anxious' | 'Sad' | 'Angry'
  energy?: number
  trigger?: 'Work' | 'Health' | 'Social' | 'Money' | 'Family' | 'Sleep' | 'Weather' | 'Other'
}

/** Workout field values */
export interface WorkoutFields {
  workoutType?: 'Strength' | 'Cardio' | 'Flexibility' | 'Mixed'
  place?: 'Home' | 'In Building Gym' | 'Outside Gym'
  duration?: number
  exercises?: string  // Comma-separated exercise names
}

/** Vault field values (Obsidian note links) */
export interface VaultFields {
  title?: string
  obsidianUrl?: string
}

/** Media field values (books, movies, games, etc.) */
export interface MediaFields {
  mediaType?: 'Book' | 'Movie' | 'Game' | 'TV' | 'Anime' | 'Podcast'
  title?: string
}

/** Union of all known field value types */
export type KnownFieldValues = TaskFields | BookmarkFields | MoodFields | WorkoutFields | MediaFields

/** Field values - known types or unknown for custom content types */
export type EntryFieldValues = KnownFieldValues | Record<string, unknown>

// ============================================
// Entry
// ============================================

/** Timeline entry */
export interface Entry {
  id: string
  type: EntryType
  content: string
  timestamp: number
  sessionId?: string              // SESSION_START only
  duration?: number               // SESSION_END only (ms)
  category?: CategoryId           // Life area category
  contentType?: string            // References ContentType.id
  fieldValues?: EntryFieldValues  // Typed field values
  linkedEntries?: string[]        // Bidirectional linked entry IDs
  tags?: string[]                 // Free-form tags (without # prefix)
  aiComment?: string              // AI-generated comment (collapsible bubble)
}

// ============================================
// Session State & Actions
// ============================================

/** Session state */
export interface SessionState {
  status: SessionStatus
  sessionStart: number | null
  entries: Entry[]
  contentTypes: ContentType[]     // User's content types (includes built-in)
  mediaItems: MediaItem[]         // User's media library
  apiKey: string | null
  aiBaseUrl: string
  aiModel: string
  aiPersona?: string              // Customizable AI persona/system prompt
}

/** Action payloads */
export interface LogInPayload {
  content: string
}

export interface SwitchPayload {
  content: string
}

export interface NotePayload {
  content: string
  contentType?: string
  fieldValues?: Record<string, unknown>
  category?: CategoryId
  tags?: string[]
}

export interface LogOffPayload {
  content?: string
}

export interface DeleteEntryPayload {
  entryId: string
}

export interface EditEntryPayload {
  entryId: string
  content: string
}

export interface UpdateEntryPayload {
  entryId: string
  content?: string
  timestamp?: number
  category?: CategoryId
  contentType?: string
  fieldValues?: Record<string, unknown>
  linkedEntries?: string[]
  tags?: string[]
  type?: EntryType
  aiComment?: string
}

export interface SetEntryCategoryPayload {
  entryId: string
  category: CategoryId
}

export interface SetApiKeyPayload {
  apiKey: string
}

export interface SetAIConfigPayload {
  apiKey?: string
  aiBaseUrl?: string
  aiModel?: string
  aiPersona?: string
}

export interface ImportDataPayload {
  entries?: Entry[]
  contentTypes?: ContentType[]
  mediaItems?: MediaItem[]
}

// ContentType actions
export interface AddContentTypePayload {
  contentType: ContentType
}

export interface UpdateContentTypePayload {
  id: string
  updates: Partial<Omit<ContentType, 'id' | 'builtIn'>>
}

export interface DeleteContentTypePayload {
  id: string
}

// Media library actions
export interface AddMediaItemPayload {
  mediaItem: MediaItem
}

export interface UpdateMediaItemPayload {
  id: string
  updates: Partial<Omit<MediaItem, 'id' | 'createdAt'>>
}

export interface DeleteMediaItemPayload {
  id: string
}

/** Discriminated union of all session actions */
export type SessionAction =
  | { type: 'LOG_IN'; payload: LogInPayload }
  | { type: 'SWITCH'; payload: SwitchPayload }
  | { type: 'NOTE'; payload: NotePayload }
  | { type: 'LOG_OFF'; payload?: LogOffPayload }
  | { type: 'DELETE_ENTRY'; payload: DeleteEntryPayload }
  | { type: 'EDIT_ENTRY'; payload: EditEntryPayload }
  | { type: 'UPDATE_ENTRY'; payload: UpdateEntryPayload }
  | { type: 'SET_ENTRY_CATEGORY'; payload: SetEntryCategoryPayload }
  | { type: 'SET_API_KEY'; payload: SetApiKeyPayload }
  | { type: 'SET_AI_CONFIG'; payload: SetAIConfigPayload }
  | { type: 'LOAD_STATE'; payload: Partial<SessionState> }
  | { type: 'IMPORT_DATA'; payload: ImportDataPayload }
  | { type: 'ADD_CONTENT_TYPE'; payload: AddContentTypePayload }
  | { type: 'UPDATE_CONTENT_TYPE'; payload: UpdateContentTypePayload }
  | { type: 'DELETE_CONTENT_TYPE'; payload: DeleteContentTypePayload }
  | { type: 'ADD_MEDIA_ITEM'; payload: AddMediaItemPayload }
  | { type: 'UPDATE_MEDIA_ITEM'; payload: UpdateMediaItemPayload }
  | { type: 'DELETE_MEDIA_ITEM'; payload: DeleteMediaItemPayload }

// ============================================
// Hook Return Types
// ============================================

/** Actions returned by useSession */
export interface SessionActions {
  logIn: (content: string) => void
  switchSession: (content: string) => void
  addNote: (content: string, options?: { contentType?: string; fieldValues?: Record<string, unknown>; category?: CategoryId; tags?: string[] }) => void
  logOff: (content?: string) => void
  deleteEntry: (entryId: string) => void
  editEntry: (entryId: string, content: string) => void
  setApiKey: (apiKey: string) => void
  setAIConfig: (config: SetAIConfigPayload) => void
  setEntryCategory: (entryId: string, category: CategoryId) => void
  updateEntry: (entryId: string, updates: Omit<UpdateEntryPayload, 'entryId'>) => void
  importData: (data: ImportDataPayload) => void
  addContentType: (contentType: ContentType) => void
  updateContentType: (id: string, updates: Partial<Omit<ContentType, 'id' | 'builtIn'>>) => void
  deleteContentType: (id: string) => void
  addMediaItem: (mediaItem: MediaItem) => void
  updateMediaItem: (id: string, updates: Partial<Omit<MediaItem, 'id' | 'createdAt'>>) => void
  deleteMediaItem: (id: string) => void
}

/** useSession hook return type */
export interface UseSessionReturn {
  state: SessionState
  isStreaming: boolean
  actions: SessionActions
}

// ============================================
// Cloud Sync Types
// ============================================

export interface CloudSyncState {
  isAuthenticated: boolean
  isSyncing: boolean
  lastSynced: number | null
  error: string | null
}

export interface CloudData {
  entries: Entry[]
  contentTypes?: ContentType[]
  mediaItems?: MediaItem[]
  categories?: Category[] | null
  lastModified?: number | null
}
