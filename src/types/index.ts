// ============================================
// Core Data Types
// ============================================

/** Entry type discriminator (system-level, controls session flow) */
export type EntryType = 'SESSION_START' | 'NOTE' | 'SESSION_END'

/** Session status */
export type SessionStatus = 'IDLE' | 'STREAMING'

/** Category IDs (fixed, not user-editable) - life areas */
export type CategoryId = 'hustle' | 'craft' | 'hardware' | 'sparks' | 'barter' | 'wander' | 'beans'

/** Category definition */
export interface Category {
  id: CategoryId
  label: string
  color: string
  description: string  // Description for AI categorization
}

// ============================================
// ContentType System (user-editable schemas)
// ============================================

/** Field types for ContentType schema */
export type FieldType = 'text' | 'number' | 'dropdown' | 'boolean'

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
  color?: string
  fields: FieldDefinition[]
  builtIn?: boolean     // System types can't be deleted
  order?: number        // Display order
}

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
  fieldValues?: Record<string, unknown>  // Dynamic field values
  linkedEntries?: string[]        // Bidirectional linked entry IDs
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
  apiKey: string | null
  aiBaseUrl: string
  aiModel: string
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
}

export interface ImportDataPayload {
  entries?: Entry[]
  contentTypes?: ContentType[]
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

// ============================================
// Hook Return Types
// ============================================

/** Actions returned by useSession */
export interface SessionActions {
  logIn: (content: string) => void
  switchSession: (content: string) => void
  addNote: (content: string, options?: { contentType?: string; fieldValues?: Record<string, unknown> }) => void
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
  categories?: Category[] | null
  lastModified?: number | null
}
