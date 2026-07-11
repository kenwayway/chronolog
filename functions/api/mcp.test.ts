import { describe, expect, it } from 'vitest';
import { computeSessions } from './mcp.ts';

describe('computeSessions', () => {
    it('derives duration from edited timestamps and uses the start category', () => {
        const sessions = computeSessions([
            { id: 'start', type: 'SESSION_START', timestamp: 1_000, category: 'hardware' },
            { id: 'end', type: 'SESSION_END', timestamp: 3_601_000, category: null },
        ]);

        expect(sessions).toEqual([
            {
                startId: 'start',
                startTimestamp: 1_000,
                category: 'hardware',
                durationMs: 3_600_000,
            },
        ]);
    });

    it('pairs consecutive sessions independently and ignores unmatched ends', () => {
        const sessions = computeSessions([
            { id: 'orphan-end', type: 'SESSION_END', timestamp: 500, category: null },
            { id: 'craft-start', type: 'SESSION_START', timestamp: 1_000, category: 'craft' },
            { id: 'craft-end', type: 'SESSION_END', timestamp: 61_000, category: null },
            { id: 'work-start', type: 'SESSION_START', timestamp: 120_000, category: 'work' },
            { id: 'work-end', type: 'SESSION_END', timestamp: 240_000, category: null },
        ]);

        expect(sessions.map(session => ({
            startId: session.startId,
            category: session.category,
            durationMs: session.durationMs,
        }))).toEqual([
            { startId: 'craft-start', category: 'craft', durationMs: 60_000 },
            { startId: 'work-start', category: 'work', durationMs: 120_000 },
        ]);
    });
});
