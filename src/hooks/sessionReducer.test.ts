import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACTIONS, SESSION_STATUS } from '@/utils/constants'
import { initialState, sessionReducer } from './sessionReducer'
import type { Note, Session, SessionState } from '@/types'

function stateWith(overrides: Partial<SessionState>): SessionState {
    return { ...initialState, ...overrides }
}

function note(overrides: Partial<Note> = {}): Note {
    return { id: 'note-1', content: 'hello', timestamp: 100, ...overrides }
}

function session(overrides: Partial<Session> = {}): Session {
    return { id: 'session-1', content: 'work', startAt: 100, endAt: null, ...overrides }
}

afterEach(() => vi.restoreAllMocks())

describe('sessionReducer domain model', () => {
    it('starts and closes a first-class session without boundary records', () => {
        const now = vi.spyOn(Date, 'now').mockReturnValue(100)
        const started = sessionReducer(initialState, {
            type: ACTIONS.LOG_IN,
            payload: { content: 'build #craft' },
        })

        expect(started.status).toBe(SESSION_STATUS.STREAMING)
        expect(started.notes).toEqual([])
        expect(started.sessions).toHaveLength(1)
        expect(started.sessions[0]).toMatchObject({
            content: 'build',
            startAt: 100,
            endAt: null,
            tags: ['craft'],
        })

        now.mockReturnValue(250)
        const closed = sessionReducer(started, {
            type: ACTIONS.LOG_OFF,
            payload: { content: 'done #shipped' },
        })
        expect(closed.status).toBe(SESSION_STATUS.IDLE)
        expect(closed.sessions[0]).toMatchObject({
            endAt: 250,
            endContent: 'done',
            endTags: ['shipped'],
        })
    })

    it('uses custom timestamps for log in and log off', () => {
        vi.spyOn(Date, 'now').mockReturnValue(1_000)
        const started = sessionReducer(initialState, {
            type: ACTIONS.LOG_IN,
            payload: { content: 'backfilled work', timestamp: 400 },
        })
        expect(started.sessions[0].startAt).toBe(400)

        const closed = sessionReducer(started, {
            type: ACTIONS.LOG_OFF,
            payload: { content: 'done', timestamp: 900 },
        })
        expect(closed.sessions[0].endAt).toBe(900)
    })

    it('uses a custom timestamp for a note, falling back to now', () => {
        vi.spyOn(Date, 'now').mockReturnValue(1_000)
        const backdated = sessionReducer(initialState, {
            type: ACTIONS.NOTE,
            payload: { content: 'logged late', timestamp: 400 },
        })
        expect(backdated.notes[0].timestamp).toBe(400)

        const live = sessionReducer(initialState, {
            type: ACTIONS.NOTE,
            payload: { content: 'logged now' },
        })
        expect(live.notes[0].timestamp).toBe(1_000)
    })

    it('switches by closing the current session and opening another atomically', () => {
        vi.spyOn(Date, 'now').mockReturnValue(300)
        const current = session({ id: 'old', startAt: 100 })
        const result = sessionReducer(stateWith({
            status: 'STREAMING',
            activeSessionId: current.id,
            sessions: [current],
        }), {
            type: ACTIONS.SWITCH,
            payload: { content: 'next' },
        })

        expect(result.sessions).toHaveLength(2)
        expect(result.sessions[0].endAt).toBe(300)
        expect(result.sessions[1]).toMatchObject({ content: 'next', startAt: 300, endAt: null })
        expect(result.activeSessionId).toBe(result.sessions[1].id)
    })

    it('attaches notes to the active session', () => {
        vi.spyOn(Date, 'now').mockReturnValue(150)
        const result = sessionReducer(stateWith({
            status: 'STREAMING',
            activeSessionId: 'session-1',
            sessions: [session()],
        }), {
            type: ACTIONS.NOTE,
            payload: { content: 'detail' },
        })
        expect(result.notes[0]).toMatchObject({
            content: 'detail',
            timestamp: 150,
            sessionId: 'session-1',
        })
    })

    it('creates an entry-anchored zaddy comment without touching its target or active session', () => {
        vi.spyOn(Date, 'now').mockReturnValue(175)
        const target = note()
        const base = stateWith({
            status: 'STREAMING',
            activeSessionId: 'session-1',
            sessions: [session()],
            notes: [target],
        })
        const result = sessionReducer(base, {
            type: ACTIONS.COMMENT,
            payload: { targetId: target.id, content: '  I see you.  ' },
        })

        expect(result.notes[0]).toBe(target)
        expect(result.notes[1]).toMatchObject({
            content: 'I see you.',
            timestamp: 175,
            contentType: 'zaddy-comment',
            linkedItems: [target.id],
            origin: 'zaddy',
        })
        expect(result.notes[1].sessionId).toBeUndefined()
        expect(result.sessions[0]).toBe(base.sessions[0])
    })

    it('does not create a comment for an invalid target or another comment', () => {
        const existingComment = note({
            id: 'comment-1',
            contentType: 'zaddy-comment',
            linkedItems: ['note-1'],
            origin: 'zaddy',
        })
        const base = stateWith({ notes: [existingComment] })

        const missing = sessionReducer(base, {
            type: ACTIONS.COMMENT,
            payload: { targetId: 'missing', content: 'nope' },
        })
        const nested = sessionReducer(base, {
            type: ACTIONS.COMMENT,
            payload: { targetId: existingComment.id, content: 'also nope' },
        })

        expect(missing).toBe(base)
        expect(nested).toBe(base)
    })

    it('updates notes and session boundaries through separate actions', () => {
        const base = stateWith({ notes: [note()], sessions: [session()] })
        const withNote = sessionReducer(base, {
            type: ACTIONS.UPDATE_NOTE,
            payload: { noteId: 'note-1', content: 'changed', linkedItems: ['session-1'] },
        })
        const result = sessionReducer(withNote, {
            type: ACTIONS.UPDATE_SESSION,
            payload: { sessionId: 'session-1', endAt: 500, endContent: 'finished' },
        })

        expect(result.notes[0]).toMatchObject({ content: 'changed', linkedItems: ['session-1'] })
        expect(result.sessions[0]).toMatchObject({ endAt: 500, endContent: 'finished' })
    })

    it('deleting a session detaches its notes and removes links', () => {
        const result = sessionReducer(stateWith({
            status: 'STREAMING',
            activeSessionId: 'session-1',
            sessions: [session()],
            notes: [note({ sessionId: 'session-1', linkedItems: ['session-1'] })],
        }), {
            type: ACTIONS.DELETE_SESSION,
            payload: { sessionId: 'session-1' },
        })

        expect(result.sessions).toEqual([])
        expect(result.notes[0].sessionId).toBeUndefined()
        expect(result.notes[0].linkedItems).toEqual([])
        expect(result.status).toBe('IDLE')
    })

    it('deleting a session keeps untouched notes referentially identical', () => {
        const untouched = note({ id: 'unrelated' })
        const attached = note({ id: 'attached', sessionId: 'session-1' })
        const result = sessionReducer(stateWith({
            sessions: [session()],
            notes: [untouched, attached],
        }), {
            type: ACTIONS.DELETE_SESSION,
            payload: { sessionId: 'session-1' },
        })

        // Persistence and sync diff by reference; cloning untouched notes
        // would rewrite the whole store on every session delete.
        expect(result.notes[0]).toBe(untouched)
        expect(result.notes[1]).not.toBe(attached)
        expect(result.notes[1].sessionId).toBeUndefined()
    })

    it('loads the newest open session as active', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.LOAD_STATE,
            payload: {
                sessions: [
                    session({ id: 'older', startAt: 100 }),
                    session({ id: 'closed', startAt: 200, endAt: 250 }),
                    session({ id: 'newer', startAt: 300 }),
                ],
            },
        })
        expect(result.activeSessionId).toBe('newer')
        expect(result.status).toBe('STREAMING')
    })

    it('removes retired workout exercises from loaded notes and sessions', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.LOAD_STATE,
            payload: {
                notes: [note({
                    contentType: 'workout',
                    fieldValues: { workoutType: 'Strength', exercises: 'squats' },
                })],
                sessions: [session({
                    contentType: 'workout',
                    fieldValues: { place: 'Home', exercises: 'push-ups' },
                })],
            },
        })

        expect(result.notes[0].fieldValues).toEqual({ workoutType: 'Strength' })
        expect(result.sessions[0].fieldValues).toEqual({ place: 'Home' })
    })

    it('removes the retired bookmark status from loaded notes', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.LOAD_STATE,
            payload: {
                notes: [note({
                    contentType: 'bookmark',
                    fieldValues: { url: 'https://example.com', type: 'Article', status: 'Inbox' },
                })],
            },
        })

        expect(result.notes[0].fieldValues).toEqual({
            url: 'https://example.com',
            type: 'Article',
        })
    })

    it('drops fieldValues entirely when the retired field was all that was left', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.LOAD_STATE,
            payload: {
                notes: [note({ contentType: 'bookmark', fieldValues: { status: 'Reading' } })],
            },
        })

        expect(result.notes[0].fieldValues).toBeUndefined()
    })

    it('leaves other content types untouched', () => {
        const result = sessionReducer(initialState, {
            type: ACTIONS.LOAD_STATE,
            payload: {
                notes: [note({
                    contentType: 'mood',
                    fieldValues: { feeling: 'Calm', status: 'Inbox' },
                })],
            },
        })

        // `status` is only retired on bookmark; a custom type may still use the name.
        expect(result.notes[0].fieldValues).toEqual({ feeling: 'Calm', status: 'Inbox' })
    })
})
