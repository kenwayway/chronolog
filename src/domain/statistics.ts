import type { Note, Session } from "@/types";

export type StatsRangeId = "7d" | "30d" | "90d" | "year";

export interface StatsPeriod {
    start: number;
    end: number;
    previousStart: number;
    previousEnd: number;
}

export interface StatsTotal {
    id: string;
    value: number;
}

export interface DailyTrackedTotal {
    dayStart: number;
    totalMs: number;
}

export interface StatsSummary {
    trackedMs: number;
    sessionCount: number;
    noteCount: number;
    activeDays: number;
    averageActiveDayMs: number;
    categoryTotals: StatsTotal[];
    contentTypeTotals: StatsTotal[];
    tagTotals: StatsTotal[];
    dailyTotals: DailyTrackedTotal[];
    heatmap: number[][];
}

interface BuildStatsOptions {
    notes: Note[];
    sessions: Session[];
    start: number;
    end: number;
    now: number;
    activeSessionId: string | null;
}

const RANGE_DAYS: Record<Exclude<StatsRangeId, "year">, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
};

function startOfDay(timestamp: number): number {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function nextDay(timestamp: number): number {
    const date = new Date(timestamp);
    date.setDate(date.getDate() + 1);
    return date.getTime();
}

function dayKey(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function getStatsPeriod(range: StatsRangeId, now = Date.now()): StatsPeriod {
    const end = now;
    const current = new Date(now);
    let start: number;

    if (range === "year") {
        start = new Date(current.getFullYear(), 0, 1).getTime();
    } else {
        const firstDay = new Date(current.getFullYear(), current.getMonth(), current.getDate());
        firstDay.setDate(firstDay.getDate() - (RANGE_DAYS[range] - 1));
        start = firstDay.getTime();
    }

    const duration = end - start;
    return {
        start,
        end,
        previousStart: start - duration,
        previousEnd: start,
    };
}

function addTotal(totals: Map<string, number>, id: string, value = 1) {
    totals.set(id, (totals.get(id) || 0) + value);
}

function sortedTotals(totals: Map<string, number>): StatsTotal[] {
    return [...totals.entries()]
        .map(([id, value]) => ({ id, value }))
        .sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
}

function markIntervalDays(days: Set<string>, start: number, end: number) {
    let cursor = startOfDay(start);
    while (cursor < end) {
        days.add(dayKey(cursor));
        cursor = nextDay(cursor);
    }
}

function addIntervalToDays(
    dailyByStart: Map<number, number>,
    start: number,
    end: number,
) {
    let cursor = start;
    while (cursor < end) {
        const currentDay = startOfDay(cursor);
        const boundary = Math.min(nextDay(currentDay), end);
        dailyByStart.set(currentDay, (dailyByStart.get(currentDay) || 0) + boundary - cursor);
        cursor = boundary;
    }
}

function addIntervalToHeatmap(heatmap: number[][], start: number, end: number) {
    let cursor = start;
    while (cursor < end) {
        const date = new Date(cursor);
        const block = Math.floor(date.getHours() / 6);
        const boundary = new Date(date);
        boundary.setHours((block + 1) * 6, 0, 0, 0);
        const segmentEnd = Math.min(boundary.getTime(), end);
        const weekday = (date.getDay() + 6) % 7;
        heatmap[weekday][block] += segmentEnd - cursor;
        cursor = segmentEnd;
    }
}

export function buildStatsSummary({
    notes,
    sessions,
    start,
    end,
    now,
    activeSessionId,
}: BuildStatsOptions): StatsSummary {
    const categoryTotals = new Map<string, number>();
    const contentTypeTotals = new Map<string, number>();
    const tagTotals = new Map<string, number>();
    const activeDayKeys = new Set<string>();
    const dailyByStart = new Map<number, number>();
    const heatmap = Array.from({ length: 7 }, () => Array<number>(4).fill(0));

    for (let cursor = startOfDay(start); cursor < end; cursor = nextDay(cursor)) {
        dailyByStart.set(cursor, 0);
    }

    let trackedMs = 0;
    let sessionCount = 0;

    for (const session of sessions) {
        if (session.origin === "zaddy") continue;
        if (session.endAt === null && session.id !== activeSessionId) continue;

        const sessionEnd = session.endAt ?? now;
        const clippedStart = Math.max(session.startAt, start);
        const clippedEnd = Math.min(sessionEnd, end);
        if (clippedEnd <= clippedStart) continue;

        const duration = clippedEnd - clippedStart;
        trackedMs += duration;
        sessionCount += 1;
        addTotal(categoryTotals, session.category || "uncategorized", duration);
        addIntervalToDays(dailyByStart, clippedStart, clippedEnd);
        addIntervalToHeatmap(heatmap, clippedStart, clippedEnd);
        markIntervalDays(activeDayKeys, clippedStart, clippedEnd);

        if (session.startAt >= start && session.startAt < end) {
            addTotal(contentTypeTotals, session.contentType || "session");
            for (const tag of new Set([...(session.tags || []), ...(session.endTags || [])])) {
                addTotal(tagTotals, tag);
            }
        }
    }

    let noteCount = 0;
    for (const note of notes) {
        if (note.origin === "zaddy" || note.timestamp < start || note.timestamp >= end) continue;
        noteCount += 1;
        activeDayKeys.add(dayKey(note.timestamp));
        addTotal(contentTypeTotals, note.contentType || "note");
        for (const tag of new Set(note.tags || [])) addTotal(tagTotals, tag);
    }

    const activeDays = activeDayKeys.size;
    return {
        trackedMs,
        sessionCount,
        noteCount,
        activeDays,
        averageActiveDayMs: activeDays > 0 ? trackedMs / activeDays : 0,
        categoryTotals: sortedTotals(categoryTotals),
        contentTypeTotals: sortedTotals(contentTypeTotals),
        tagTotals: sortedTotals(tagTotals),
        dailyTotals: [...dailyByStart.entries()].map(([dayStart, totalMs]) => ({ dayStart, totalMs })),
        heatmap,
    };
}
