import { describe, expect, it } from "vitest";
import { buildStatsSummary, getStatsPeriod } from "./statistics";
import type { Note, Session } from "@/types";

describe("statistics", () => {
    it("builds a trailing calendar-day period", () => {
        const now = new Date(2026, 7, 19, 15, 30).getTime();
        const period = getStatsPeriod("7d", now);

        expect(new Date(period.start)).toEqual(new Date(2026, 7, 13));
        expect(period.end).toBe(now);
        expect(period.previousEnd).toBe(period.start);
        expect(period.previousEnd - period.previousStart).toBe(period.end - period.start);
    });

    it("clips sessions to the period and splits time across midnight", () => {
        const start = new Date(2026, 7, 18).getTime();
        const end = new Date(2026, 7, 20).getTime();
        const sessions: Session[] = [{
            id: "late",
            content: "late work",
            startAt: new Date(2026, 7, 18, 23).getTime(),
            endAt: new Date(2026, 7, 19, 1).getTime(),
            category: "craft",
        }];

        const summary = buildStatsSummary({
            notes: [],
            sessions,
            start,
            end,
            now: end,
            activeSessionId: null,
        });

        expect(summary.trackedMs).toBe(2 * 60 * 60 * 1000);
        expect(summary.activeDays).toBe(2);
        expect(summary.dailyTotals.map(day => day.totalMs)).toEqual([
            60 * 60 * 1000,
            60 * 60 * 1000,
        ]);
        expect(summary.categoryTotals).toEqual([{ id: "craft", value: 2 * 60 * 60 * 1000 }]);
    });

    it("excludes zaddy data and stale open sessions", () => {
        const start = new Date(2026, 7, 19).getTime();
        const end = new Date(2026, 7, 20).getTime();
        const sessions: Session[] = [
            { id: "ambient", content: "observation", startAt: start, endAt: start + 1000, origin: "zaddy" },
            { id: "stale", content: "stale", startAt: start, endAt: null },
            { id: "active", content: "active", startAt: start, endAt: null },
        ];
        const notes: Note[] = [
            { id: "comment", content: "remark", timestamp: start + 100, origin: "zaddy" },
            { id: "note", content: "mine", timestamp: start + 200 },
        ];

        const summary = buildStatsSummary({
            notes,
            sessions,
            start,
            end,
            now: start + 5000,
            activeSessionId: "active",
        });

        expect(summary.trackedMs).toBe(5000);
        expect(summary.sessionCount).toBe(1);
        expect(summary.noteCount).toBe(1);
    });

    it("counts one tag per entity even when it appears on both session boundaries", () => {
        const start = new Date(2026, 7, 19).getTime();
        const end = new Date(2026, 7, 20).getTime();
        const sessions: Session[] = [{
            id: "tagged",
            content: "work",
            startAt: start + 1000,
            endAt: start + 2000,
            tags: ["deep"],
            endTags: ["deep", "done"],
        }];

        const summary = buildStatsSummary({
            notes: [],
            sessions,
            start,
            end,
            now: end,
            activeSessionId: null,
        });

        expect(summary.tagTotals).toEqual([
            { id: "deep", value: 1 },
            { id: "done", value: 1 },
        ]);
    });
});
