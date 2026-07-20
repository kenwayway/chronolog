import { describe, it, expect } from 'vitest'
import { pairSessions, sessionDurationsByStartId } from './sessionPairing'
import type { Entry } from '@/types'

let counter = 0
function entry(overrides: Partial<Entry>): Entry {
    return {
        id: `e${++counter}`,
        type: 'NOTE',
        content: '',
        timestamp: 0,
        ...overrides,
    }
}

describe('pairSessions', () => {
    it('pairs START/END by matching sessionId', () => {
        const start = entry({ type: 'SESSION_START', timestamp: 1000, sessionId: 's1' })
        const end = entry({ type: 'SESSION_END', timestamp: 4000, sessionId: 's1' })
        const sessions = pairSessions([start, end])
        expect(sessions).toHaveLength(1)
        expect(sessions[0].start).toBe(start)
        expect(sessions[0].end).toBe(end)
        expect(sessions[0].durationMs).toBe(3000)
    })

    it('pairs interleaved sessions from a sync merge correctly', () => {
        // Device A: s1 from 1000-5000; Device B: s2 from 2000-3000 (interleaved)
        const startA = entry({ type: 'SESSION_START', timestamp: 1000, sessionId: 's1' })
        const startB = entry({ type: 'SESSION_START', timestamp: 2000, sessionId: 's2' })
        const endB = entry({ type: 'SESSION_END', timestamp: 3000, sessionId: 's2' })
        const endA = entry({ type: 'SESSION_END', timestamp: 5000, sessionId: 's1' })
        const sessions = pairSessions([startA, startB, endB, endA])
        expect(sessions).toHaveLength(2)
        expect(sessions[0].start).toBe(startA)
        expect(sessions[0].durationMs).toBe(4000)
        expect(sessions[1].start).toBe(startB)
        expect(sessions[1].durationMs).toBe(1000)
    })

    it('falls back to chronological pairing for a legacy END without sessionId', () => {
        const start = entry({ type: 'SESSION_START', timestamp: 1000, sessionId: 's1' })
        const end = entry({ type: 'SESSION_END', timestamp: 2500 })
        const sessions = pairSessions([start, end])
        expect(sessions).toHaveLength(1)
        expect(sessions[0].end).toBe(end)
        expect(sessions[0].durationMs).toBe(1500)
    })

    it('sorts by timestamp before pairing (input order irrelevant)', () => {
        const start = entry({ type: 'SESSION_START', timestamp: 1000, sessionId: 's1' })
        const end = entry({ type: 'SESSION_END', timestamp: 2000, sessionId: 's1' })
        const sessions = pairSessions([end, start])
        expect(sessions[0].durationMs).toBe(1000)
    })

    it('keeps the pair when a timestamp edit moves the END before another session', () => {
        // s1 END was edited to 1500, before s2 even starts — sessionId keeps pairing intact
        const start1 = entry({ type: 'SESSION_START', timestamp: 1000, sessionId: 's1' })
        const end1 = entry({ type: 'SESSION_END', timestamp: 1500, sessionId: 's1' })
        const start2 = entry({ type: 'SESSION_START', timestamp: 2000, sessionId: 's2' })
        const end2 = entry({ type: 'SESSION_END', timestamp: 3000, sessionId: 's2' })
        const sessions = pairSessions([start1, start2, end1, end2])
        expect(sessions).toHaveLength(2)
        expect(sessions[0].end).toBe(end1)
        expect(sessions[0].durationMs).toBe(500)
        expect(sessions[1].end).toBe(end2)
        expect(sessions[1].durationMs).toBe(1000)
    })

    it('leaves an unclosed session open instead of stealing another session\'s END', () => {
        const start1 = entry({ type: 'SESSION_START', timestamp: 1000, sessionId: 's1' })
        const start2 = entry({ type: 'SESSION_START', timestamp: 2000, sessionId: 's2' })
        const end2 = entry({ type: 'SESSION_END', timestamp: 3000, sessionId: 's2' })
        const sessions = pairSessions([start1, start2, end2])
        expect(sessions).toHaveLength(2)
        expect(sessions[0].end).toBeNull()
        expect(sessions[0].durationMs).toBeNull()
        expect(sessions[1].end).toBe(end2)
    })

    it('drops an END whose sessionId matches no open session', () => {
        const start = entry({ type: 'SESSION_START', timestamp: 1000, sessionId: 's1' })
        const orphanEnd = entry({ type: 'SESSION_END', timestamp: 2000, sessionId: 'ghost' })
        const sessions = pairSessions([start, orphanEnd])
        expect(sessions).toHaveLength(1)
        expect(sessions[0].end).toBeNull()
    })

    it('ignores NOTE entries', () => {
        const start = entry({ type: 'SESSION_START', timestamp: 1000, sessionId: 's1' })
        const note = entry({ type: 'NOTE', timestamp: 1500, sessionId: 's1' })
        const end = entry({ type: 'SESSION_END', timestamp: 2000, sessionId: 's1' })
        const sessions = pairSessions([start, note, end])
        expect(sessions).toHaveLength(1)
        expect(sessions[0].durationMs).toBe(1000)
    })
})

describe('sessionDurationsByStartId', () => {
    it('returns closed-session durations keyed by START id', () => {
        const start1 = entry({ type: 'SESSION_START', timestamp: 1000, sessionId: 's1' })
        const end1 = entry({ type: 'SESSION_END', timestamp: 3000, sessionId: 's1' })
        const start2 = entry({ type: 'SESSION_START', timestamp: 5000, sessionId: 's2' })
        const durations = sessionDurationsByStartId([start1, end1, start2])
        expect(durations).toEqual({ [start1.id]: 2000 })
    })
})
