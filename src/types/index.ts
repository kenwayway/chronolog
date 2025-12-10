// ============================================
// Core Data Types
// ============================================

/** Entry type discriminator */
export type EntryType = 'SESSION_START' | 'NOTE' | 'SESSION_END' | 'TASK' | 'TASK_DONE'

/** Session status */
export type SessionStatus = 'IDLE' | 'STREAMING'

/** Category IDs (fixed, not user-editable) */
export type CategoryId = 'hustle' | 'craft' | 'hardware' | 'kernel' | 'barter' | 'wonder' | 'beans'

/** Category definition */
export interface Category {
    id: CategoryId
    label: string
    color: string
}

/** Timeline entry */
export interface Entry {
    id: string
    type: EntryType
    content: string
    timestamp: number
    sessionId?: string        // SESSION_START only
    duration?: number         // SESSION_END only (ms)
    category?: CategoryId
    originalTaskId?: string   // TASK_DONE only
    originalCreatedAt?: number // TASK_DONE only
}

// ============================================
// Session State & Actions
// ============================================

/** Session state */
export interface SessionState {
    status: SessionStatus
    sessionStart: number | null
    entries: Entry[]
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
}

export interface LogOffPayload {
    content?: string
}

export interface CompleteTaskPayload {
    entryId?: string
    content: string
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
}

export interface SetEntryCategoryPayload {
    entryId: string
    category: CategoryId
}

export interface MarkAsTaskPayload {
    entryId: string
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
}

/** Discriminated union of all session actions */
export type SessionAction =
    | { type: 'LOG_IN'; payload: LogInPayload }
    | { type: 'SWITCH'; payload: SwitchPayload }
    | { type: 'NOTE'; payload: NotePayload }
    | { type: 'LOG_OFF'; payload?: LogOffPayload }
    | { type: 'COMPLETE_TASK'; payload: CompleteTaskPayload }
    | { type: 'DELETE_ENTRY'; payload: DeleteEntryPayload }
    | { type: 'EDIT_ENTRY'; payload: EditEntryPayload }
    | { type: 'UPDATE_ENTRY'; payload: UpdateEntryPayload }
    | { type: 'SET_ENTRY_CATEGORY'; payload: SetEntryCategoryPayload }
    | { type: 'MARK_AS_TASK'; payload: MarkAsTaskPayload }
    | { type: 'SET_API_KEY'; payload: SetApiKeyPayload }
    | { type: 'SET_AI_CONFIG'; payload: SetAIConfigPayload }
    | { type: 'LOAD_STATE'; payload: Partial<SessionState> }
    | { type: 'IMPORT_DATA'; payload: ImportDataPayload }

// ============================================
// Hook Return Types
// ============================================

/** Actions returned by useSession */
export interface SessionActions {
    logIn: (content: string) => void
    switchSession: (content: string) => void
    addNote: (content: string) => void
    logOff: (content?: string) => void
    completeTask: (entryId: string | undefined, content: string) => void
    deleteEntry: (entryId: string) => void
    editEntry: (entryId: string, content: string) => void
    setApiKey: (apiKey: string) => void
    setAIConfig: (config: SetAIConfigPayload) => void
    setEntryCategory: (entryId: string, category: CategoryId) => void
    markAsTask: (entryId: string) => void
    updateEntry: (entryId: string, updates: Omit<UpdateEntryPayload, 'entryId'>) => void
    importData: (data: ImportDataPayload) => void
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
    categories?: Category[] | null
    lastModified?: number | null
}
