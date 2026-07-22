import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sessionReducer, initialState } from './sessionReducer'
import { ACTIONS, SESSION_STATUS, ENTRY_TYPES } from '@/utils/constants'
import type { SessionState, Entry, MediaItem, Session } from '@/types'

// Mock generateId to return predictable values
let idCounter = 0
vi.mock('../utils/formatters', () => ({
    generateId: () => `mock-id-${++idCounter}`,
}))

beforeEach(() => {
    idCounter = 0
})

// Helper: create a state with some entries
function stateWith(overrides: Partial<SessionState>): SessionState {
    return { ...initialState, ...overrides }
}

function makeEntry(overrides: Partial<Entry> = {}): Entry {
    return {
        id: `entry-${++idCounter}`,
        type: 'NOTE',
        content: 'test',
        timestamp: 1000,
        ...overrides,
    }
}

function makeSession(overrides: Partial<Session> = {}): Session {
    return {
        id: `session-${++idCounter}`,
        startEntryId: `start-${idCounter}`,
        content: 'test session',
        startAt: 1000,
        endAt: null,
        ...overrides,
    }
}

// ========================================
// LOG_IN
// ========================================
describe('LOG_IN', () => {
    it('creates a first-class session and sets STREAMING', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.LOG_IN,
            payload: { content: 'starting work' },
        })

        expect(result.status).toBe(SESSION_STATUS.STREAMING)
        expect(result.activeSessionId).toBeTypeOf('string')
        expect(result.entries).toHaveLength(0)
        expect(result.sessions).toHaveLength(1)

        const session = result.sessions[0]
        expect(session.content).toBe('starting work')
        expect(session.startEntryId).toBeDefined()
        expect(session.endAt).toBeNull()
    })

    it('extracts tags from content', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.LOG_IN,
            payload: { content: 'working on #project' },
        })

        const session = result.sessions[0]
        expect(session.content).toBe('working on')
        expect(session.tags).toEqual(['project'])
    })
})

// ========================================
// NOTE
// ========================================
describe('NOTE', () => {
    it('creates a NOTE entry', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.NOTE,
            payload: { content: 'hello world' },
        })

        expect(result.entries).toHaveLength(1)
        const entry = result.entries[0]
        expect(entry.type).toBe(ENTRY_TYPES.NOTE)
        expect(entry.content).toBe('hello world')
    })

    it('passes through contentType and fieldValues', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.NOTE,
            payload: {
                content: 'gym',
                contentType: 'workout',
                fieldValues: { workoutType: 'Strength' },
                category: 'hardware',
            },
        })

        const entry = result.entries[0]
        expect(entry.contentType).toBe('workout')
        expect(entry.fieldValues).toEqual({ workoutType: 'Strength' })
        expect(entry.category).toBe('hardware')
    })

    it('prefers manual tags over parsed tags', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.NOTE,
            payload: {
                content: 'text #parsed',
                tags: ['manual'],
            },
        })

        const entry = result.entries[0]
        expect(entry.tags).toEqual(['manual'])
    })

    it('carries the open session\'s sessionId while streaming', () => {
        const session = makeSession({ id: 'session-abc' })
        const state = stateWith({
            status: SESSION_STATUS.STREAMING,
            activeSessionId: 'session-abc',
            sessions: [session],
        })

        const result = sessionReducer(state, {
            type: ACTIONS.NOTE,
            payload: { content: 'mid-session note' },
        })

        const note = result.entries[result.entries.length - 1]
        expect(note.sessionId).toBe('session-abc')
    })

    it('has no sessionId when idle', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.NOTE,
            payload: { content: 'standalone note' },
        })
        expect(result.entries[0].sessionId).toBeUndefined()
    })

    it('uses parsed tags when no manual tags provided', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.NOTE,
            payload: { content: 'text #auto-tag' },
        })

        const entry = result.entries[0]
        expect(entry.tags).toEqual(['auto-tag'])
        expect(entry.content).toBe('text')
    })
})

// ========================================
// LOG_OFF
// ========================================
describe('LOG_OFF', () => {
    const streamingState = stateWith({
        status: SESSION_STATUS.STREAMING,
        activeSessionId: 'session-abc',
        sessions: [makeSession({ id: 'session-abc' })],
    })

    it('closes the active session and sets IDLE', () => {
        const result = sessionReducer(streamingState, {
            type: ACTIONS.LOG_OFF,
            payload: { content: 'done' },
        })

        expect(result.status).toBe(SESSION_STATUS.IDLE)
        expect(result.activeSessionId).toBeNull()
        expect(result.entries).toHaveLength(0)

        const session = result.sessions[0]
        expect(session.endAt).toBeTypeOf('number')
        expect(session.endContent).toBe('done')
    })

    it('returns same state when not streaming', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.LOG_OFF,
            payload: { content: 'done' },
        })
        expect(result).toBe(initialState)
    })

    it('closes exactly the active session', () => {
        const session = makeSession({ id: 'session-abc' })
        const state = stateWith({
            status: SESSION_STATUS.STREAMING,
            activeSessionId: 'session-abc',
            sessions: [session],
        })

        const result = sessionReducer(state, {
            type: ACTIONS.LOG_OFF,
            payload: { content: 'done' },
        })

        expect(result.sessions[0].id).toBe('session-abc')
        expect(result.sessions[0].endAt).not.toBeNull()
    })
})

// ========================================
// DELETE_ENTRY
// ========================================
describe('DELETE_ENTRY', () => {
    it('removes the specified entry', () => {
        const entry1 = makeEntry({ id: 'keep' })
        const entry2 = makeEntry({ id: 'remove' })
        const state = stateWith({ entries: [entry1, entry2] })

        const result = sessionReducer(state, {
            type: ACTIONS.DELETE_ENTRY,
            payload: { entryId: 'remove' },
        })

        expect(result.entries).toHaveLength(1)
        expect(result.entries[0].id).toBe('keep')
    })
})

// ========================================
// EDIT_ENTRY
// ========================================
describe('EDIT_ENTRY', () => {
    it('updates content of specified entry', () => {
        const entry = makeEntry({ id: 'e1', content: 'old' })
        const state = stateWith({ entries: [entry] })

        const result = sessionReducer(state, {
            type: ACTIONS.EDIT_ENTRY,
            payload: { entryId: 'e1', content: 'new content' },
        })

        expect(result.entries[0].content).toBe('new content')
    })

    it('does not modify other entries', () => {
        const entry1 = makeEntry({ id: 'e1', content: 'untouched' })
        const entry2 = makeEntry({ id: 'e2', content: 'old' })
        const state = stateWith({ entries: [entry1, entry2] })

        const result = sessionReducer(state, {
            type: ACTIONS.EDIT_ENTRY,
            payload: { entryId: 'e2', content: 'new' },
        })

        expect(result.entries[0]).toBe(entry1) // Same reference
        expect(result.entries[1].content).toBe('new')
    })
})

// ========================================
// UPDATE_ENTRY
// ========================================
describe('UPDATE_ENTRY', () => {
    it('partially updates entry fields', () => {
        const entry = makeEntry({ id: 'e1', content: 'test', category: undefined })
        const state = stateWith({ entries: [entry] })

        const result = sessionReducer(state, {
            type: ACTIONS.UPDATE_ENTRY,
            payload: { entryId: 'e1', category: 'craft' },
        })

        expect(result.entries[0].category).toBe('craft')
        expect(result.entries[0].content).toBe('test') // Unchanged
    })

    it('clears tags when empty array provided', () => {
        const entry = makeEntry({ id: 'e1', tags: ['old'] })
        const state = stateWith({ entries: [entry] })

        const result = sessionReducer(state, {
            type: ACTIONS.UPDATE_ENTRY,
            payload: { entryId: 'e1', tags: [] },
        })

        expect(result.entries[0].tags).toBeUndefined()
    })

    it('clears category when null provided', () => {
        const entry = makeEntry({ id: 'e1', category: 'craft' })
        const state = stateWith({ entries: [entry] })

        const result = sessionReducer(state, {
            type: ACTIONS.UPDATE_ENTRY,
            payload: { entryId: 'e1', category: null },
        })

        expect(result.entries[0].category).toBeUndefined()
    })

    it('leaves category unchanged when undefined', () => {
        const entry = makeEntry({ id: 'e1', category: 'craft' })
        const state = stateWith({ entries: [entry] })

        const result = sessionReducer(state, {
            type: ACTIONS.UPDATE_ENTRY,
            payload: { entryId: 'e1', content: 'edited' },
        })

        expect(result.entries[0].category).toBe('craft')
    })

    it('clears contentType and its fieldValues when null provided', () => {
        const entry = makeEntry({ id: 'e1', contentType: 'workout', fieldValues: { workoutType: 'Cardio' } })
        const state = stateWith({ entries: [entry] })

        const result = sessionReducer(state, {
            type: ACTIONS.UPDATE_ENTRY,
            payload: { entryId: 'e1', contentType: null, fieldValues: { workoutType: 'Cardio' } },
        })

        expect(result.entries[0].contentType).toBeUndefined()
        expect(result.entries[0].fieldValues).toBeUndefined()
    })
})

// ========================================
// Media Item CRUD
// ========================================
describe('Media Item CRUD', () => {
    const testMedia: MediaItem = {
        id: 'media-1',
        title: 'Test Movie',
        mediaType: 'Movie',
        createdAt: 1000,
        rating: 8,
        status: 'Completed',
        dateFinished: '2026-02-20',
        notes: 'Great movie!',
        metadata: { director: 'Spielberg', year: 2026, genre: 'Sci-Fi' },
    }

    it('ADD_MEDIA_ITEM adds item with all fields', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.ADD_MEDIA_ITEM,
            payload: { mediaItem: testMedia },
        })

        expect(result.mediaItems).toHaveLength(1)
        expect(result.mediaItems[0].title).toBe('Test Movie')
        expect(result.mediaItems[0].rating).toBe(8)
        expect(result.mediaItems[0].status).toBe('Completed')
        expect(result.mediaItems[0].notes).toBe('Great movie!')
        expect(result.mediaItems[0].metadata?.director).toBe('Spielberg')
    })

    it('UPDATE_MEDIA_ITEM updates fields', () => {
        const state = stateWith({ mediaItems: [testMedia] })
        const result = sessionReducer(state, {
            type: ACTIONS.UPDATE_MEDIA_ITEM,
            payload: { id: 'media-1', updates: { title: 'Updated Movie', rating: 9 } },
        })

        expect(result.mediaItems[0].title).toBe('Updated Movie')
        expect(result.mediaItems[0].rating).toBe(9)
        expect(result.mediaItems[0].mediaType).toBe('Movie') // Unchanged
        expect(result.mediaItems[0].status).toBe('Completed') // Unchanged
    })

    it('DELETE_MEDIA_ITEM removes item', () => {
        const state = stateWith({ mediaItems: [testMedia] })
        const result = sessionReducer(state, {
            type: ACTIONS.DELETE_MEDIA_ITEM,
            payload: { id: 'media-1' },
        })

        expect(result.mediaItems).toHaveLength(0)
    })
})

// ========================================
// SWITCH
// ========================================
describe('SWITCH', () => {
    it('ends current session and starts new one', () => {
        const streamingState = stateWith({
            status: SESSION_STATUS.STREAMING,
            activeSessionId: 'session-old',
            sessions: [makeSession({ id: 'session-old' })],
        })

        const result = sessionReducer(streamingState, {
            type: ACTIONS.SWITCH,
            payload: { content: 'new session' },
        })

        expect(result.status).toBe(SESSION_STATUS.STREAMING)
        expect(result.entries).toHaveLength(0)
        expect(result.sessions).toHaveLength(2)
        expect(result.sessions[0].endAt).not.toBeNull()
        expect(result.sessions[1].content).toBe('new session')
    })

    it('closes the old session with its own sessionId, distinct from the new one', () => {
        const oldSession = makeSession({ id: 'session-old' })
        const streamingState = stateWith({
            status: SESSION_STATUS.STREAMING,
            activeSessionId: 'session-old',
            sessions: [oldSession],
        })

        const result = sessionReducer(streamingState, {
            type: ACTIONS.SWITCH,
            payload: { content: 'new session' },
        })

        const closed = result.sessions[0]
        const next = result.sessions[1]
        expect(closed.id).toBe('session-old')
        expect(closed.endAt).not.toBeNull()
        expect(next.id).toBeDefined()
        expect(next.id).not.toBe('session-old')
    })
})

// ========================================
// SET_ENTRY_CATEGORY
// ========================================
describe('SET_ENTRY_CATEGORY', () => {
    it('sets category on specified entry', () => {
        const entry = makeEntry({ id: 'e1' })
        const state = stateWith({ entries: [entry] })

        const result = sessionReducer(state, {
            type: ACTIONS.SET_ENTRY_CATEGORY,
            payload: { entryId: 'e1', category: 'work' },
        })

        expect(result.entries[0].category).toBe('work')
    })
})

describe('legacy boundary migration', () => {
    it('normalizes legacy START/END entries into a Session on load', () => {
        const start = makeEntry({ id: 'start', type: 'SESSION_START', content: 'focus', timestamp: 1000, sessionId: 'session-1' })
        const note = makeEntry({ id: 'note', type: 'NOTE', timestamp: 1500, sessionId: 'session-1' })
        const end = makeEntry({ id: 'end', type: 'SESSION_END', content: 'done', timestamp: 2000, sessionId: 'session-1' })

        const result = sessionReducer(initialState, {
            type: ACTIONS.LOAD_STATE,
            payload: { entries: [start, note, end] },
        })

        expect(result.entries.map(entry => entry.id)).toEqual(['note'])
        expect(result.sessions).toEqual([expect.objectContaining({
            id: 'session-1',
            startEntryId: 'start',
            endEntryId: 'end',
            startAt: 1000,
            endAt: 2000,
        })])
        expect(result.activeSessionId).toBeNull()
    })

    it('routes projected boundary edits to the canonical session', () => {
        const session = makeSession({ id: 'session-1', startEntryId: 'start' })
        const state = stateWith({ sessions: [session], activeSessionId: 'session-1', status: SESSION_STATUS.STREAMING })

        const result = sessionReducer(state, {
            type: ACTIONS.UPDATE_ENTRY,
            payload: { entryId: 'start', content: 'renamed', category: 'craft' },
        })

        expect(result.sessions[0].content).toBe('renamed')
        expect(result.sessions[0].category).toBe('craft')
    })

    it('deleting a projected session boundary deletes the interval and detaches its notes', () => {
        const session = makeSession({ id: 'session-1', startEntryId: 'start' })
        const note = makeEntry({ id: 'note', sessionId: 'session-1' })
        const state = stateWith({
            sessions: [session],
            entries: [note],
            activeSessionId: 'session-1',
            status: SESSION_STATUS.STREAMING,
        })

        const result = sessionReducer(state, {
            type: ACTIONS.DELETE_ENTRY,
            payload: { entryId: 'start' },
        })

        expect(result.sessions).toEqual([])
        expect(result.entries[0].sessionId).toBeUndefined()
        expect(result.activeSessionId).toBeNull()
        expect(result.status).toBe(SESSION_STATUS.IDLE)
    })
})
