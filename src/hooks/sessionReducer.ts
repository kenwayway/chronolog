import { ENTRY_TYPES, SESSION_STATUS, ACTIONS, BUILTIN_CONTENT_TYPES } from '@/utils/constants'
import { generateId } from '@/utils/formatters'
import { parseTags } from '@/utils/tagParser'
import { migrateEntries } from '@/utils/migrateEntries'
import { importLegacySessions, sessionForBoundary } from '@/utils/legacySessionAdapter'
import type {
    Entry,
    Session,
    SessionState,
    SessionAction,
    ContentType,
    LogInPayload,
    SwitchPayload,
    NotePayload,
    LogOffPayload,
    DeleteEntryPayload,
    EditEntryPayload,
    UpdateEntryPayload,
    SetEntryCategoryPayload,
    ImportDataPayload,
    AddMediaItemPayload,
    UpdateMediaItemPayload,
    DeleteMediaItemPayload,
} from '@/types'

// Initial state
export const initialState: SessionState = {
    status: SESSION_STATUS.IDLE,
    activeSessionId: null,
    sessions: [],
    entries: [],
    contentTypes: [...BUILTIN_CONTENT_TYPES],
    mediaItems: []
}

// ============================================
// Shared helpers
// ============================================

/** Merge built-in content types with incoming ones, preferring local if version is higher */
function mergeContentTypes(incoming: ContentType[]): ContentType[] {
    const builtInIds = BUILTIN_CONTENT_TYPES.map(ct => ct.id)
    return [
        ...BUILTIN_CONTENT_TYPES.map(builtIn => {
            const match = incoming.find(ct => ct.id === builtIn.id)
            if (!match) return builtIn
            if ((builtIn.version ?? 0) > (match.version ?? 0)) return builtIn
            return { ...match, builtIn: true }
        }),
        ...incoming.filter(ct => !builtInIds.includes(ct.id))
    ]
}

function createSession(payload: LogInPayload | SwitchPayload, now: number): Session {
    const { cleanContent, tags: parsedTags } = parseTags(payload.content)
    const finalTags = payload.tags && payload.tags.length > 0
        ? payload.tags
        : (parsedTags.length > 0 ? parsedTags : undefined)

    return {
        id: generateId(),
        startEntryId: generateId(),
        content: cleanContent,
        startAt: now,
        endAt: null,
        contentType: payload.contentType,
        fieldValues: payload.fieldValues,
        category: payload.category,
        tags: finalTags,
    }
}

function closeSession(session: Session, now: number, content = '', tags?: string[]): Session {
    return {
        ...session,
        endAt: now,
        endEntryId: session.endEntryId || generateId(),
        endContent: content || undefined,
        endTags: tags && tags.length > 0 ? tags : undefined,
    }
}

// ============================================
// Action handlers
// ============================================

function handleLogIn(state: SessionState, payload: LogInPayload): SessionState {
    const now = Date.now()
    const newSession = createSession(payload, now)
    const sessions = state.activeSessionId
        ? state.sessions.map(session => session.id === state.activeSessionId ? closeSession(session, now) : session)
        : state.sessions
    return {
        ...state,
        status: SESSION_STATUS.STREAMING,
        activeSessionId: newSession.id,
        sessions: [...sessions, newSession],
    }
}

function handleSwitch(state: SessionState, payload: SwitchPayload): SessionState {
    const now = Date.now()
    const newSession = createSession(payload, now)
    const sessions = state.sessions.map(session =>
        session.id === state.activeSessionId ? closeSession(session, now) : session
    )

    return {
        ...state,
        status: SESSION_STATUS.STREAMING,
        activeSessionId: newSession.id,
        sessions: [...sessions, newSession],
    }
}

function handleNote(state: SessionState, payload: NotePayload): SessionState {
    const { cleanContent, tags: parsedTags } = parseTags(payload.content)
    const finalTags = payload.tags && payload.tags.length > 0
        ? payload.tags
        : (parsedTags.length > 0 ? parsedTags : undefined)
    const newEntry: Entry = {
        id: generateId(),
        type: ENTRY_TYPES.NOTE,
        content: cleanContent,
        timestamp: Date.now(),
        sessionId: state.activeSessionId || undefined,
        contentType: payload.contentType,
        fieldValues: payload.fieldValues,
        category: payload.category,
        tags: finalTags
    }
    return {
        ...state,
        entries: [...state.entries, newEntry]
    }
}

function handleLogOff(state: SessionState, payload?: LogOffPayload): SessionState {
    if (state.status !== SESSION_STATUS.STREAMING) {
        console.warn('Cannot log off when not streaming')
        return state
    }
    const originalContent = payload?.content || 'Session ended'
    const { cleanContent, tags } = parseTags(originalContent)
    const now = Date.now()
    return {
        ...state,
        status: SESSION_STATUS.IDLE,
        activeSessionId: null,
        sessions: state.sessions.map(session =>
            session.id === state.activeSessionId ? closeSession(session, now, cleanContent, tags) : session
        ),
    }
}

function handleDeleteEntry(state: SessionState, payload: DeleteEntryPayload): SessionState {
    const boundary = sessionForBoundary(state.sessions, payload.entryId)
    if (boundary) {
        const deletingActive = boundary.session.id === state.activeSessionId
        return {
            ...state,
            status: deletingActive ? SESSION_STATUS.IDLE : state.status,
            activeSessionId: deletingActive ? null : state.activeSessionId,
            sessions: state.sessions.filter(session => session.id !== boundary.session.id),
            entries: state.entries.map(entry =>
                entry.sessionId === boundary.session.id ? { ...entry, sessionId: undefined } : entry
            ),
        }
    }
    return {
        ...state,
        entries: state.entries.filter(e => e.id !== payload.entryId)
    }
}

function handleEditEntry(state: SessionState, payload: EditEntryPayload): SessionState {
    const boundary = sessionForBoundary(state.sessions, payload.entryId)
    if (boundary) {
        return {
            ...state,
            sessions: state.sessions.map(session => {
                if (session.id !== boundary.session.id) return session
                return boundary.boundary === 'start'
                    ? { ...session, content: payload.content }
                    : { ...session, endContent: payload.content || undefined }
            }),
        }
    }
    return {
        ...state,
        entries: state.entries.map(e =>
            e.id === payload.entryId ? { ...e, content: payload.content } : e
        )
    }
}

function handleUpdateEntry(state: SessionState, payload: UpdateEntryPayload): SessionState {
    const { entryId, content, timestamp, category, contentType, fieldValues, linkedEntries, tags, type } = payload
    const boundary = sessionForBoundary(state.sessions, entryId)
    if (boundary) {
        return {
            ...state,
            sessions: state.sessions.map(session => {
                if (session.id !== boundary.session.id) return session
                if (boundary.boundary === 'end') {
                    return {
                        ...session,
                        endContent: content !== undefined ? (content || undefined) : session.endContent,
                        endAt: timestamp !== undefined ? timestamp : session.endAt,
                        endTags: tags !== undefined ? (tags.length > 0 ? tags : undefined) : session.endTags,
                        endLinkedEntries: linkedEntries !== undefined ? linkedEntries : session.endLinkedEntries,
                    }
                }

                const updated = { ...session }
                if (content !== undefined) updated.content = content
                if (timestamp !== undefined) updated.startAt = timestamp
                if (category !== undefined) updated.category = category ?? undefined
                if (contentType !== undefined) {
                    updated.contentType = contentType ?? undefined
                    if (contentType === null) updated.fieldValues = undefined
                }
                if (fieldValues !== undefined && contentType !== null) updated.fieldValues = fieldValues
                if (linkedEntries !== undefined) updated.linkedEntries = linkedEntries
                if (tags !== undefined) updated.tags = tags.length > 0 ? tags : undefined
                return updated
            }),
        }
    }
    return {
        ...state,
        entries: state.entries.map(e => {
            if (e.id !== entryId) return e
            const updated = { ...e }
            if (content !== undefined) updated.content = content
            if (timestamp !== undefined) updated.timestamp = timestamp
            if (category !== undefined) updated.category = category ?? undefined
            if (contentType !== undefined) {
                updated.contentType = contentType ?? undefined
                // Clearing the content type orphans its field values — drop them
                if (contentType === null) updated.fieldValues = undefined
            }
            if (fieldValues !== undefined && contentType !== null) updated.fieldValues = fieldValues
            if (linkedEntries !== undefined) updated.linkedEntries = linkedEntries
            if (tags !== undefined) updated.tags = tags.length > 0 ? tags : undefined
            if (type !== undefined) updated.type = type
            return updated
        })
    }
}

function handleSetEntryCategory(state: SessionState, payload: SetEntryCategoryPayload): SessionState {
    const boundary = sessionForBoundary(state.sessions, payload.entryId)
    if (boundary?.boundary === 'start') {
        return {
            ...state,
            sessions: state.sessions.map(session =>
                session.id === boundary.session.id ? { ...session, category: payload.category } : session
            ),
        }
    }
    return {
        ...state,
        entries: state.entries.map(e =>
            e.id === payload.entryId ? { ...e, category: payload.category } : e
        )
    }
}

function handleLoadState(state: SessionState, payload: Partial<SessionState>): SessionState {
    const loadedContentTypes = payload.contentTypes || []
    const mergedContentTypes = mergeContentTypes(loadedContentTypes)
    const migratedEntries = migrateEntries(payload.entries || [], mergedContentTypes)
    const imported = importLegacySessions(migratedEntries, payload.sessions || [])

    return {
        ...initialState,
        ...payload,
        entries: imported.entries,
        sessions: imported.sessions,
        activeSessionId: imported.activeSessionId,
        contentTypes: mergedContentTypes,
        mediaItems: payload.mediaItems || state.mediaItems || [],
        status: imported.activeSessionId ? SESSION_STATUS.STREAMING : SESSION_STATUS.IDLE
    }
}

function handleImportData(state: SessionState, payload: ImportDataPayload): SessionState {
    const importedEntries = payload.entries || state.entries
    const importedContentTypes = payload.contentTypes || []

    const mergedContentTypes = mergeContentTypes(importedContentTypes)
    const finalContentTypes = mergedContentTypes.length > 0 ? mergedContentTypes : state.contentTypes
    const migratedEntries = migrateEntries(importedEntries, finalContentTypes)
    const canonicalSessions = payload.sessions ?? (payload.entries ? [] : state.sessions)
    const imported = importLegacySessions(migratedEntries, canonicalSessions)

    return {
        ...state,
        entries: imported.entries,
        sessions: imported.sessions,
        contentTypes: finalContentTypes,
        mediaItems: payload.mediaItems || state.mediaItems,
        status: imported.activeSessionId ? SESSION_STATUS.STREAMING : SESSION_STATUS.IDLE,
        activeSessionId: imported.activeSessionId,
    }
}

function handleAddMediaItem(state: SessionState, payload: AddMediaItemPayload): SessionState {
    return {
        ...state,
        mediaItems: [...state.mediaItems, payload.mediaItem]
    }
}

function handleUpdateMediaItem(state: SessionState, payload: UpdateMediaItemPayload): SessionState {
    return {
        ...state,
        mediaItems: state.mediaItems.map(item =>
            item.id === payload.id ? { ...item, ...payload.updates } : item
        )
    }
}

function handleDeleteMediaItem(state: SessionState, payload: DeleteMediaItemPayload): SessionState {
    return {
        ...state,
        mediaItems: state.mediaItems.filter(item => item.id !== payload.id)
    }
}

// ============================================
// Reducer (thin dispatch)
// ============================================

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
    switch (action.type) {
        case ACTIONS.LOG_IN: return handleLogIn(state, action.payload)
        case ACTIONS.SWITCH: return handleSwitch(state, action.payload)
        case ACTIONS.NOTE: return handleNote(state, action.payload)
        case ACTIONS.LOG_OFF: return handleLogOff(state, action.payload)
        case ACTIONS.DELETE_ENTRY: return handleDeleteEntry(state, action.payload)
        case ACTIONS.EDIT_ENTRY: return handleEditEntry(state, action.payload)
        case ACTIONS.UPDATE_ENTRY: return handleUpdateEntry(state, action.payload)
        case ACTIONS.SET_ENTRY_CATEGORY: return handleSetEntryCategory(state, action.payload)
        case ACTIONS.LOAD_STATE: return handleLoadState(state, action.payload)
        case ACTIONS.IMPORT_DATA: return handleImportData(state, action.payload)
        case ACTIONS.ADD_MEDIA_ITEM: return handleAddMediaItem(state, action.payload)
        case ACTIONS.UPDATE_MEDIA_ITEM: return handleUpdateMediaItem(state, action.payload)
        case ACTIONS.DELETE_MEDIA_ITEM: return handleDeleteMediaItem(state, action.payload)
        default: return state
    }
}
