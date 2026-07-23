import { ACTIONS, BUILTIN_CONTENT_TYPES, SESSION_STATUS } from '@/utils/constants'
import { generateId } from '@/utils/formatters'
import { parseTags } from '@/utils/tagParser'
import type {
    AddMediaItemPayload,
    ContentType,
    DeleteMediaItemPayload,
    ImportDataPayload,
    LogInPayload,
    LogOffPayload,
    Note,
    NotePayload,
    Session,
    SessionAction,
    SessionState,
    SwitchPayload,
    UpdateMediaItemPayload,
    UpdateNotePayload,
    UpdateSessionPayload,
} from '@/types'

export const initialState: SessionState = {
    status: SESSION_STATUS.IDLE,
    activeSessionId: null,
    sessions: [],
    notes: [],
    contentTypes: [...BUILTIN_CONTENT_TYPES],
    mediaItems: [],
}

function mergeContentTypes(incoming: ContentType[]): ContentType[] {
    const builtInIds = BUILTIN_CONTENT_TYPES.map(type => type.id)
    return [
        ...BUILTIN_CONTENT_TYPES.map(builtIn => {
            const match = incoming.find(type => type.id === builtIn.id)
            if (!match || (builtIn.version ?? 0) > (match.version ?? 0)) return builtIn
            return { ...match, builtIn: true }
        }),
        ...incoming.filter(type => !builtInIds.includes(type.id)),
    ]
}

function createSession(payload: LogInPayload | SwitchPayload, now: number): Session {
    const { cleanContent, tags: parsedTags } = parseTags(payload.content)
    const tags = payload.tags?.length
        ? payload.tags
        : (parsedTags.length > 0 ? parsedTags : undefined)

    return {
        id: generateId(),
        content: cleanContent,
        startAt: now,
        endAt: null,
        contentType: payload.contentType,
        fieldValues: payload.fieldValues,
        category: payload.category,
        tags,
    }
}

function closeSession(session: Session, now: number, content = '', tags?: string[]): Session {
    return {
        ...session,
        endAt: now,
        endContent: content || undefined,
        endTags: tags?.length ? tags : undefined,
    }
}

function handleLogIn(state: SessionState, payload: LogInPayload): SessionState {
    const now = Date.now()
    const session = createSession(payload, now)
    return {
        ...state,
        status: SESSION_STATUS.STREAMING,
        activeSessionId: session.id,
        sessions: [
            ...state.sessions.map(current =>
                current.id === state.activeSessionId ? closeSession(current, now) : current
            ),
            session,
        ],
    }
}

function handleSwitch(state: SessionState, payload: SwitchPayload): SessionState {
    return handleLogIn(state, payload)
}

function handleNote(state: SessionState, payload: NotePayload): SessionState {
    const { cleanContent, tags: parsedTags } = parseTags(payload.content)
    const note: Note = {
        id: generateId(),
        content: cleanContent,
        timestamp: Date.now(),
        sessionId: state.activeSessionId || undefined,
        contentType: payload.contentType,
        fieldValues: payload.fieldValues,
        category: payload.category,
        tags: payload.tags?.length
            ? payload.tags
            : (parsedTags.length > 0 ? parsedTags : undefined),
    }
    return { ...state, notes: [...state.notes, note] }
}

function handleLogOff(state: SessionState, payload?: LogOffPayload): SessionState {
    if (state.status !== SESSION_STATUS.STREAMING || !state.activeSessionId) {
        console.warn('Cannot log off when not streaming')
        return state
    }

    const { cleanContent, tags } = parseTags(payload?.content || 'Session ended')
    const now = Date.now()
    return {
        ...state,
        status: SESSION_STATUS.IDLE,
        activeSessionId: null,
        sessions: state.sessions.map(session =>
            session.id === state.activeSessionId
                ? closeSession(session, now, cleanContent, tags)
                : session
        ),
    }
}

function handleDeleteNote(state: SessionState, noteId: string): SessionState {
    return {
        ...state,
        notes: state.notes
            .filter(note => note.id !== noteId)
            .map(note => note.linkedItems?.includes(noteId)
                ? { ...note, linkedItems: note.linkedItems.filter(id => id !== noteId) }
                : note
            ),
        sessions: state.sessions.map(session => session.linkedItems?.includes(noteId)
            ? { ...session, linkedItems: session.linkedItems.filter(id => id !== noteId) }
            : session
        ),
    }
}

function handleDeleteSession(state: SessionState, sessionId: string): SessionState {
    const deletingActive = state.activeSessionId === sessionId
    return {
        ...state,
        status: deletingActive ? SESSION_STATUS.IDLE : state.status,
        activeSessionId: deletingActive ? null : state.activeSessionId,
        sessions: state.sessions
            .filter(session => session.id !== sessionId)
            .map(session => session.linkedItems?.includes(sessionId)
                ? { ...session, linkedItems: session.linkedItems.filter(id => id !== sessionId) }
                : session
            ),
        notes: state.notes.map(note => {
            const next = { ...note }
            if (next.sessionId === sessionId) next.sessionId = undefined
            if (next.linkedItems?.includes(sessionId)) {
                next.linkedItems = next.linkedItems.filter(id => id !== sessionId)
            }
            return next
        }),
    }
}

function updateCommonFields<T extends Note | Session>(
    entity: T,
    payload: Pick<UpdateNotePayload | UpdateSessionPayload, 'content' | 'category' | 'contentType' | 'fieldValues' | 'linkedItems' | 'tags'>,
): T {
    const updated = { ...entity }
    if (payload.content !== undefined) updated.content = payload.content
    if (payload.category !== undefined) updated.category = payload.category ?? undefined
    if (payload.contentType !== undefined) {
        updated.contentType = payload.contentType ?? undefined
        if (payload.contentType === null) updated.fieldValues = undefined
    }
    if (payload.fieldValues !== undefined && payload.contentType !== null) {
        updated.fieldValues = payload.fieldValues
    }
    if (payload.linkedItems !== undefined) updated.linkedItems = payload.linkedItems
    if (payload.tags !== undefined) updated.tags = payload.tags.length ? payload.tags : undefined
    return updated
}

function handleUpdateNote(state: SessionState, payload: UpdateNotePayload): SessionState {
    return {
        ...state,
        notes: state.notes.map(note => {
            if (note.id !== payload.noteId) return note
            const updated = updateCommonFields(note, payload)
            if (payload.timestamp !== undefined) updated.timestamp = payload.timestamp
            if (payload.sessionId !== undefined) updated.sessionId = payload.sessionId ?? undefined
            return updated
        }),
    }
}

function handleUpdateSession(state: SessionState, payload: UpdateSessionPayload): SessionState {
    return {
        ...state,
        sessions: state.sessions.map(session => {
            if (session.id !== payload.sessionId) return session
            const updated = updateCommonFields(session, payload)
            if (payload.startAt !== undefined) updated.startAt = payload.startAt
            if (payload.endAt !== undefined) updated.endAt = payload.endAt
            if (payload.endContent !== undefined) updated.endContent = payload.endContent ?? undefined
            if (payload.endTags !== undefined) updated.endTags = payload.endTags.length ? payload.endTags : undefined
            return updated
        }),
    }
}

function loadedActiveSession(sessions: Session[]): string | null {
    const open = sessions.filter(session => session.endAt === null)
    if (open.length === 0) return null
    const sorted = [...open].sort((left, right) => left.startAt - right.startAt)
    return sorted[sorted.length - 1].id
}

function handleLoadState(state: SessionState, payload: Partial<SessionState>): SessionState {
    const sessions = payload.sessions ?? []
    const activeSessionId = loadedActiveSession(sessions)
    return {
        ...initialState,
        ...payload,
        notes: payload.notes ?? [],
        sessions,
        activeSessionId,
        contentTypes: mergeContentTypes(payload.contentTypes ?? []),
        mediaItems: payload.mediaItems ?? state.mediaItems,
        status: activeSessionId ? SESSION_STATUS.STREAMING : SESSION_STATUS.IDLE,
    }
}

function handleImportData(state: SessionState, payload: ImportDataPayload): SessionState {
    const sessions = payload.sessions ?? state.sessions
    const activeSessionId = loadedActiveSession(sessions)
    return {
        ...state,
        notes: payload.notes ?? state.notes,
        sessions,
        activeSessionId,
        contentTypes: payload.contentTypes
            ? mergeContentTypes(payload.contentTypes)
            : state.contentTypes,
        mediaItems: payload.mediaItems ?? state.mediaItems,
        status: activeSessionId ? SESSION_STATUS.STREAMING : SESSION_STATUS.IDLE,
    }
}

function handleAddMediaItem(state: SessionState, payload: AddMediaItemPayload): SessionState {
    return { ...state, mediaItems: [...state.mediaItems, payload.mediaItem] }
}

function handleUpdateMediaItem(state: SessionState, payload: UpdateMediaItemPayload): SessionState {
    return {
        ...state,
        mediaItems: state.mediaItems.map(item =>
            item.id === payload.id ? { ...item, ...payload.updates } : item
        ),
    }
}

function handleDeleteMediaItem(state: SessionState, payload: DeleteMediaItemPayload): SessionState {
    return { ...state, mediaItems: state.mediaItems.filter(item => item.id !== payload.id) }
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
    switch (action.type) {
        case ACTIONS.LOG_IN: return handleLogIn(state, action.payload)
        case ACTIONS.SWITCH: return handleSwitch(state, action.payload)
        case ACTIONS.NOTE: return handleNote(state, action.payload)
        case ACTIONS.LOG_OFF: return handleLogOff(state, action.payload)
        case ACTIONS.DELETE_NOTE: return handleDeleteNote(state, action.payload.noteId)
        case ACTIONS.DELETE_SESSION: return handleDeleteSession(state, action.payload.sessionId)
        case ACTIONS.UPDATE_NOTE: return handleUpdateNote(state, action.payload)
        case ACTIONS.UPDATE_SESSION: return handleUpdateSession(state, action.payload)
        case ACTIONS.LOAD_STATE: return handleLoadState(state, action.payload)
        case ACTIONS.IMPORT_DATA: return handleImportData(state, action.payload)
        case ACTIONS.ADD_MEDIA_ITEM: return handleAddMediaItem(state, action.payload)
        case ACTIONS.UPDATE_MEDIA_ITEM: return handleUpdateMediaItem(state, action.payload)
        case ACTIONS.DELETE_MEDIA_ITEM: return handleDeleteMediaItem(state, action.payload)
        default: return state
    }
}
