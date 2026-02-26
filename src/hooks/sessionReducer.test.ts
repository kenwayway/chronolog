import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sessionReducer, initialState } from './sessionReducer'
import { ACTIONS, SESSION_STATUS, ENTRY_TYPES } from '@/utils/constants'
import type { SessionState, Entry, ContentType, MediaItem } from '@/types'

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

// ========================================
// LOG_IN
// ========================================
describe('LOG_IN', () => {
    it('creates a SESSION_START entry and sets STREAMING', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.LOG_IN,
            payload: { content: 'starting work' },
        })

        expect(result.status).toBe(SESSION_STATUS.STREAMING)
        expect(result.sessionStart).toBeTypeOf('number')
        expect(result.entries).toHaveLength(1)

        const entry = result.entries[0]
        expect(entry.type).toBe(ENTRY_TYPES.SESSION_START)
        expect(entry.content).toBe('starting work')
        expect(entry.sessionId).toBeDefined()
    })

    it('extracts tags from content', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.LOG_IN,
            payload: { content: 'working on #project' },
        })

        const entry = result.entries[0]
        expect(entry.content).toBe('working on')
        expect(entry.tags).toEqual(['project'])
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
        status: SESSION_STATUS.STREAMING as any,
        sessionStart: 1000,
    })

    it('creates SESSION_END and sets IDLE', () => {
        const result = sessionReducer(streamingState, {
            type: ACTIONS.LOG_OFF,
            payload: { content: 'done' },
        })

        expect(result.status).toBe(SESSION_STATUS.IDLE)
        expect(result.sessionStart).toBeNull()
        expect(result.entries).toHaveLength(1)

        const entry = result.entries[0]
        expect(entry.type).toBe(ENTRY_TYPES.SESSION_END)
        expect(entry.content).toBe('done')
        expect(entry.duration).toBeTypeOf('number')
    })

    it('returns same state when not streaming', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.LOG_OFF,
            payload: { content: 'done' },
        })
        expect(result).toBe(initialState)
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

    it('can clear aiComment with explicit undefined', () => {
        const entry = makeEntry({ id: 'e1', aiComment: 'old comment' })
        const state = stateWith({ entries: [entry] })

        const result = sessionReducer(state, {
            type: ACTIONS.UPDATE_ENTRY,
            payload: { entryId: 'e1', aiComment: undefined },
        })

        expect(result.entries[0].aiComment).toBeUndefined()
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
})

// ========================================
// SET_AI_CONFIG
// ========================================
describe('SET_AI_CONFIG', () => {
    it('merges partial config', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.SET_AI_CONFIG,
            payload: { aiModel: 'gpt-4o' },
        })

        expect(result.aiModel).toBe('gpt-4o')
        expect(result.aiBaseUrl).toBe(initialState.aiBaseUrl) // Unchanged
    })
})

// ========================================
// Content Type CRUD
// ========================================
describe('Content Type CRUD', () => {
    it('ADD_CONTENT_TYPE adds with auto-incremented order', () => {
        const newType: ContentType = { id: 'custom-1', name: 'Custom', fields: [] }
        const result = sessionReducer(initialState, {
            type: ACTIONS.ADD_CONTENT_TYPE,
            payload: { contentType: newType },
        })

        const added = result.contentTypes.find(ct => ct.id === 'custom-1')
        expect(added).toBeDefined()
        expect(added!.order).toBeGreaterThan(0)
    })

    it('UPDATE_CONTENT_TYPE updates fields', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.UPDATE_CONTENT_TYPE,
            payload: { id: 'note', updates: { name: 'Notiz' } },
        })

        const updated = result.contentTypes.find(ct => ct.id === 'note')
        expect(updated!.name).toBe('Notiz')
    })

    it('DELETE_CONTENT_TYPE removes non-built-in types', () => {
        const custom: ContentType = { id: 'custom-1', name: 'Custom', fields: [] }
        const state = stateWith({
            contentTypes: [...initialState.contentTypes, custom],
        })

        const result = sessionReducer(state, {
            type: ACTIONS.DELETE_CONTENT_TYPE,
            payload: { id: 'custom-1' },
        })

        expect(result.contentTypes.find(ct => ct.id === 'custom-1')).toBeUndefined()
    })

    it('DELETE_CONTENT_TYPE refuses to delete built-in types', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.DELETE_CONTENT_TYPE,
            payload: { id: 'note' },
        })

        // Should be unchanged
        expect(result).toBe(initialState)
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
            status: SESSION_STATUS.STREAMING as any,
            sessionStart: 1000,
        })

        const result = sessionReducer(streamingState, {
            type: ACTIONS.SWITCH,
            payload: { content: 'new session' },
        })

        expect(result.status).toBe(SESSION_STATUS.STREAMING)
        expect(result.entries).toHaveLength(2) // SESSION_END + SESSION_START

        const endEntry = result.entries[0]
        expect(endEntry.type).toBe(ENTRY_TYPES.SESSION_END)
        expect(endEntry.duration).toBeTypeOf('number')

        const startEntry = result.entries[1]
        expect(startEntry.type).toBe(ENTRY_TYPES.SESSION_START)
        expect(startEntry.content).toBe('new session')
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
