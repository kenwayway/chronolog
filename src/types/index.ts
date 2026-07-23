// ============================================
// Re-exports
// ============================================
export type { CloudSyncStatus, CloudSyncWithUpload, CloudSyncFull, TestAIResult } from './cloudSync'

// ============================================
// Core Data Types
// ============================================

/** Session status */
export type SessionStatus = 'IDLE' | 'STREAMING'

/** Categories (fixed, not user-editable) - defined once in utils/categories.ts */
import type { CategoryId, Category } from '@/utils/categories'
export type { CategoryId, Category }

// ============================================
// Media Library
// ============================================

/** Media type options */
export type MediaType = 'Book' | 'Movie' | 'Game' | 'TV' | 'Anime' | 'Podcast'

/** Media tracking status */
export type MediaStatus = 'Planned' | 'In Progress' | 'Completed' | 'Dropped' | 'On Hold'

/** Per-type metadata (flat JSON blob stored alongside MediaItem) */
export interface MediaMetadata {
  director?: string      // Movie
  year?: number          // Movie
  genre?: string         // Movie, Book, Game
  releasedDate?: string  // Movie, Game (ISO date YYYY-MM-DD)
  author?: string        // Book
  developer?: string     // Game
  season?: number        // TV, Anime
  host?: string          // Podcast
}

/** Media item in the library */
export interface MediaItem {
  id: string              // Unique ID (uuid)
  title: string           // e.g. "Return to Silent Hill"
  mediaType: MediaType    // Book, Movie, Game, etc.
  notionUrl?: string      // Optional Notion page URL
  coverUrl?: string       // Optional cover image URL
  createdAt: number       // Timestamp when added
  // --- Shared fields ---
  rating?: number         // 1–10
  status?: MediaStatus    // Tracking status
  dateFinished?: string   // ISO date string (YYYY-MM-DD)
  notes?: string          // Free-text review/thoughts
  // --- Per-type metadata ---
  metadata?: MediaMetadata
  spotifyUrl?: string     // Optional Spotify embed URL
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

/** ContentType schema — fixed in code (BUILTIN_CONTENT_TYPES); no editing UI, no CRUD actions.
 *  Types reach state only via LOAD_STATE / IMPORT_DATA, reconciled by mergeContentTypes. */
export interface ContentType {
  id: string
  name: string
  icon?: string         // Display icon (emoji or character)
  color?: string
  fields: FieldDefinition[]
  builtIn?: boolean     // System types can't be deleted
  order?: number        // Display order
  version?: number      // Schema version — local builtins override cloud if local version is higher
}

// ============================================
// Built-in Content Type Field Values
// ============================================

/** Built-in content type IDs (type-safe literal union) */
export type BuiltInContentTypeId = 'note' | 'bookmark' | 'mood' | 'workout' | 'vault' | 'beans' | 'sparks' | 'media' | 'notion-task'

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
  exercises?: string  // Comma-separated exercise names
}

/** Vault field values (Obsidian note links) */
export interface VaultFields {
  title?: string
  obsidianUrl?: string
}

/** Media field values — mediaId references a MediaItem in the library */
export interface MediaFields {
  mediaId?: string
  // Legacy fields from before the media library existed
  mediaType?: string
  title?: string
}

/** Notion task field values — page IDs are stored as canonical UUIDs */
export interface NotionTaskFields {
  notionPageId?: string
}

/** Union of all known field value types */
export type KnownFieldValues = BookmarkFields | MoodFields | WorkoutFields | VaultFields | MediaFields | NotionTaskFields

/** Field values - known types or unknown for custom content types */
export type EntryFieldValues = KnownFieldValues | Record<string, unknown>

// ============================================
// Notes, Sessions, and Timeline View Models
// ============================================

/** A free-standing note, optionally created during a session. */
export interface Note {
  id: string
  content: string
  timestamp: number
  sessionId?: string
  category?: CategoryId
  contentType?: string
  fieldValues?: EntryFieldValues
  linkedItems?: string[]
  tags?: string[]
}

/** A timed interval. Session boundaries are derived timeline views, not entities. */
export interface Session {
  id: string
  content: string
  startAt: number
  endAt: number | null
  endContent?: string
  category?: CategoryId
  contentType?: string
  fieldValues?: EntryFieldValues
  tags?: string[]
  endTags?: string[]
  linkedItems?: string[]
}

export type TimelineItemKind = 'note' | 'session-start' | 'session-end'

/** Flattened read model used only by timeline/search/gallery UI. */
export interface TimelineItem {
  id: string
  entityId: string
  kind: TimelineItemKind
  content: string
  timestamp: number
  sessionId?: string
  category?: CategoryId
  contentType?: string
  fieldValues?: EntryFieldValues
  linkedItems?: string[]
  tags?: string[]
}

export interface TimelineItemUpdate {
  content?: string
  timestamp?: number
  category?: CategoryId | null
  contentType?: string | null
  fieldValues?: Record<string, unknown>
  linkedItems?: string[]
  tags?: string[]
}

// ============================================
// Session State & Actions
// ============================================

/** Session state */
export interface SessionState {
  status: SessionStatus
  activeSessionId: string | null
  sessions: Session[]
  notes: Note[]
  contentTypes: ContentType[]     // User's content types (includes built-in)
  mediaItems: MediaItem[]         // User's media library
}

/** Action payloads */
export interface LogInPayload {
  content: string
  contentType?: string
  fieldValues?: Record<string, unknown>
  category?: CategoryId
  tags?: string[]
}

export interface SwitchPayload {
  content: string
  contentType?: string
  fieldValues?: Record<string, unknown>
  category?: CategoryId
  tags?: string[]
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

export interface DeleteNotePayload {
  noteId: string
}

export interface DeleteSessionPayload {
  sessionId: string
}

export interface UpdateNotePayload {
  noteId: string
  content?: string
  timestamp?: number
  category?: CategoryId | null   // null = clear (undefined = leave unchanged)
  contentType?: string | null    // null = clear (undefined = leave unchanged)
  fieldValues?: Record<string, unknown>
  linkedItems?: string[]
  tags?: string[]
  sessionId?: string | null
}

export interface UpdateSessionPayload {
  sessionId: string
  content?: string
  startAt?: number
  endAt?: number | null
  endContent?: string | null
  category?: CategoryId | null
  contentType?: string | null
  fieldValues?: Record<string, unknown>
  linkedItems?: string[]
  tags?: string[]
  endTags?: string[]
}

export interface ImportDataPayload {
  notes?: Note[]
  sessions?: Session[]
  contentTypes?: ContentType[]
  mediaItems?: MediaItem[]
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
  | { type: 'DELETE_NOTE'; payload: DeleteNotePayload }
  | { type: 'DELETE_SESSION'; payload: DeleteSessionPayload }
  | { type: 'UPDATE_NOTE'; payload: UpdateNotePayload }
  | { type: 'UPDATE_SESSION'; payload: UpdateSessionPayload }
  | { type: 'LOAD_STATE'; payload: Partial<SessionState> }
  | { type: 'IMPORT_DATA'; payload: ImportDataPayload }
  | { type: 'ADD_MEDIA_ITEM'; payload: AddMediaItemPayload }
  | { type: 'UPDATE_MEDIA_ITEM'; payload: UpdateMediaItemPayload }
  | { type: 'DELETE_MEDIA_ITEM'; payload: DeleteMediaItemPayload }

// ============================================
// Hook Return Types
// ============================================

/** Actions returned by useSession */
export interface SessionActions {
  logIn: (content: string, options?: { contentType?: string; fieldValues?: Record<string, unknown>; category?: CategoryId; tags?: string[] }) => void
  switchSession: (content: string, options?: { contentType?: string; fieldValues?: Record<string, unknown>; category?: CategoryId; tags?: string[] }) => void
  addNote: (content: string, options?: { contentType?: string; fieldValues?: Record<string, unknown>; category?: CategoryId; tags?: string[] }) => void
  logOff: (content?: string) => void
  deleteNote: (noteId: string) => void
  deleteSession: (sessionId: string) => void
  updateNote: (noteId: string, updates: Omit<UpdateNotePayload, 'noteId'>) => void
  updateSession: (sessionId: string, updates: Omit<UpdateSessionPayload, 'sessionId'>) => void
  importData: (data: ImportDataPayload) => void
  addMediaItem: (mediaItem: MediaItem) => void
  updateMediaItem: (id: string, updates: Partial<Omit<MediaItem, 'id' | 'createdAt'>>) => void
  deleteMediaItem: (id: string) => void
}

/** useSession hook return type */
export interface UseSessionReturn {
  state: SessionState
  isHydrated: boolean
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
  notes: Note[]
  sessions?: Session[]
  contentTypes?: ContentType[]
  mediaItems?: MediaItem[]
  lastModified?: number | null
}

export type SyncEntityType = 'note' | 'session' | 'contentType' | 'mediaItem'
export type SyncMutationOperation = 'upsert' | 'delete'
export type SyncEntity = Note | Session | ContentType | MediaItem

/** A durable local mutation. `key` coalesces repeated edits to one entity. */
export interface SyncMutation {
  key: string
  mutationId: string
  entityType: SyncEntityType
  entityId: string
  operation: SyncMutationOperation
  value?: SyncEntity
  createdAt: number
}

export interface RevisionSyncData {
  notes: Note[]
  sessions: Session[]
  contentTypes: ContentType[]
  mediaItems: MediaItem[]
  deleted: {
    notes: string[]
    sessions: string[]
    contentTypes: string[]
    mediaItems: string[]
  }
  revision: number
  incremental: boolean
  notionSync?: NotionSyncStatus
}

export interface NotionSyncStatus {
  pending: number
  failed: number
  lastError?: string
}
