import { ENTRY_TYPES, SESSION_STATUS, ACTIONS, BUILTIN_CONTENT_TYPES } from '@/utils/constants'
import { generateId } from '@/utils/formatters'
import { parseTags } from '@/utils/tagParser'
import { migrateEntries } from '@/utils/migrateEntries'
import { pairSessions } from '@/utils/sessionPairing'
import type {
    Entry,
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
    AddContentTypePayload,
    UpdateContentTypePayload,
    DeleteContentTypePayload,
    AddMediaItemPayload,
    UpdateMediaItemPayload,
    DeleteMediaItemPayload,
} from '@/types'

// Initial state
export const initialState: SessionState = {
    status: SESSION_STATUS.IDLE,
    sessionStart: null,
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

/**
 * sessionId of the currently open session (a SESSION_START with no matching
 * SESSION_END). When merged data leaves several sessions open, the most
 * recently started one is the live session.
 */
function openSessionId(entries: Entry[]): string | undefined {
    const open = pairSessions(entries).filter(s => s.end === null)
    return open.length > 0 ? open[open.length - 1].start.sessionId : undefined
}

// ============================================
// Action handlers
// ============================================

function handleLogIn(state: SessionState, payload: LogInPayload): SessionState {
    const { cleanContent, tags: parsedTags } = parseTags(payload.content)
    const finalTags = payload.tags && payload.tags.length > 0
        ? payload.tags
        : (parsedTags.length > 0 ? parsedTags : undefined)
    const newEntry: Entry = {
        id: generateId(),
        type: ENTRY_TYPES.SESSION_START,
        content: cleanContent,
        timestamp: Date.now(),
        sessionId: generateId(),
        contentType: payload.contentType,
        fieldValues: payload.fieldValues,
        category: payload.category,
        tags: finalTags
    }
    return {
        ...state,
        status: SESSION_STATUS.STREAMING,
        sessionStart: newEntry.timestamp,
        entries: [...state.entries, newEntry]
    }
}

function handleSwitch(state: SessionState, payload: SwitchPayload): SessionState {
    const now = Date.now()
    const newSessionId = generateId()
    const newEntries = [...state.entries]

    if (state.status === SESSION_STATUS.STREAMING) {
        const endEntry: Entry = {
            id: generateId(),
            type: ENTRY_TYPES.SESSION_END,
            content: '',
            timestamp: now,
            sessionId: openSessionId(state.entries)
        }
        newEntries.push(endEntry)
    }

    const { cleanContent, tags: parsedTags } = parseTags(payload.content)
    const finalTags = payload.tags && payload.tags.length > 0
        ? payload.tags
        : (parsedTags.length > 0 ? parsedTags : undefined)
    const startEntry: Entry = {
        id: generateId(),
        type: ENTRY_TYPES.SESSION_START,
        content: cleanContent,
        timestamp: now,
        sessionId: newSessionId,
        contentType: payload.contentType,
        fieldValues: payload.fieldValues,
        category: payload.category,
        tags: finalTags
    }
    newEntries.push(startEntry)

    return {
        ...state,
        status: SESSION_STATUS.STREAMING,
        sessionStart: startEntry.timestamp,
        entries: newEntries
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
        sessionId: state.status === SESSION_STATUS.STREAMING ? openSessionId(state.entries) : undefined,
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
    const newEntry: Entry = {
        id: generateId(),
        type: ENTRY_TYPES.SESSION_END,
        content: cleanContent,
        timestamp: Date.now(),
        sessionId: openSessionId(state.entries),
        tags: tags.length > 0 ? tags : undefined
    }
    return {
        ...state,
        status: SESSION_STATUS.IDLE,
        sessionStart: null,
        entries: [...state.entries, newEntry]
    }
}

function handleDeleteEntry(state: SessionState, payload: DeleteEntryPayload): SessionState {
    return {
        ...state,
        entries: state.entries.filter(e => e.id !== payload.entryId)
    }
}

function handleEditEntry(state: SessionState, payload: EditEntryPayload): SessionState {
    return {
        ...state,
        entries: state.entries.map(e =>
            e.id === payload.entryId ? { ...e, content: payload.content } : e
        )
    }
}

function handleUpdateEntry(state: SessionState, payload: UpdateEntryPayload): SessionState {
    const { entryId, content, timestamp, category, contentType, fieldValues, linkedEntries, tags, type } = payload
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

    return {
        ...initialState,
        ...payload,
        entries: migratedEntries,
        contentTypes: mergedContentTypes,
        mediaItems: payload.mediaItems || state.mediaItems || [],
        status: payload.sessionStart ? SESSION_STATUS.STREAMING : SESSION_STATUS.IDLE
    }
}

function handleImportData(state: SessionState, payload: ImportDataPayload): SessionState {
    const importedEntries = payload.entries || []
    const importedContentTypes = payload.contentTypes || []

    let inSession = false
    let lastSessionStart: number | null = null
    for (const entry of importedEntries) {
        if (entry.type === ENTRY_TYPES.SESSION_START) {
            inSession = true
            lastSessionStart = entry.timestamp
        } else if (entry.type === ENTRY_TYPES.SESSION_END) {
            inSession = false
            lastSessionStart = null
        }
    }

    const mergedContentTypes = mergeContentTypes(importedContentTypes)
    const finalContentTypes = mergedContentTypes.length > 0 ? mergedContentTypes : state.contentTypes
    const migratedEntries = migrateEntries(importedEntries, finalContentTypes)

    return {
        ...state,
        entries: migratedEntries,
        contentTypes: finalContentTypes,
        mediaItems: payload.mediaItems || state.mediaItems,
        status: inSession ? SESSION_STATUS.STREAMING : SESSION_STATUS.IDLE,
        sessionStart: lastSessionStart
    }
}

function handleAddContentType(state: SessionState, payload: AddContentTypePayload): SessionState {
    const maxOrder = Math.max(...state.contentTypes.map(ct => ct.order ?? 0), 0)
    return {
        ...state,
        contentTypes: [...state.contentTypes, { ...payload.contentType, order: maxOrder + 1 }]
    }
}

function handleUpdateContentType(state: SessionState, payload: UpdateContentTypePayload): SessionState {
    return {
        ...state,
        contentTypes: state.contentTypes.map(ct =>
            ct.id === payload.id ? { ...ct, ...payload.updates } : ct
        )
    }
}

function handleDeleteContentType(state: SessionState, payload: DeleteContentTypePayload): SessionState {
    const typeToDelete = state.contentTypes.find(ct => ct.id === payload.id)
    if (typeToDelete?.builtIn) {
        console.warn('Cannot delete built-in content type')
        return state
    }
    return {
        ...state,
        contentTypes: state.contentTypes.filter(ct => ct.id !== payload.id)
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
        case ACTIONS.ADD_CONTENT_TYPE: return handleAddContentType(state, action.payload)
        case ACTIONS.UPDATE_CONTENT_TYPE: return handleUpdateContentType(state, action.payload)
        case ACTIONS.DELETE_CONTENT_TYPE: return handleDeleteContentType(state, action.payload)
        case ACTIONS.ADD_MEDIA_ITEM: return handleAddMediaItem(state, action.payload)
        case ACTIONS.UPDATE_MEDIA_ITEM: return handleUpdateMediaItem(state, action.payload)
        case ACTIONS.DELETE_MEDIA_ITEM: return handleDeleteMediaItem(state, action.payload)
        default: return state
    }
}
