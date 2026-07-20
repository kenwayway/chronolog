import { useEffect, useMemo, useState } from "react";
import { pairSessions } from "@/utils/sessionPairing";
import type { Category, CategoryId, Entry } from "@/types";

interface CategoryTimeChartProps {
    entries: Entry[];
    categories: Category[];
    categoryFilter: CategoryId[];
    onToggleCategory: (catId: CategoryId) => void;
}

const HOUR_MS = 3_600_000;
const UNCATEGORIZED = "__uncategorized__";
const MODULE_LOAD_TIME = Date.now();

interface HourCell {
    hour: number;
    /** Dominant occupant of this hour (category id or UNCATEGORIZED), null when empty */
    catId: string | null;
    color: string;
    label: string;
    /** Fraction of the hour covered by sessions, 0..1 */
    coverage: number;
    /** Per-category breakdown for the tooltip */
    breakdown: Array<{ label: string; ms: number }>;
}

interface LegendItem {
    id: string;
    label: string;
    color: string;
    ms: number;
    isCategory: boolean;
}

function formatHours(ms: number): string {
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Collect today's sessions as [start, end, category] intervals (includes the live session). */
function todaySessions(entries: Entry[], dayStart: number, now: number): Array<[number, number, string]> {
    const paired = pairSessions(entries);
    // Only the most recently started open session is "live"; older unclosed
    // STARTs are orphans and must not accumulate time forever.
    const openSessions = paired.filter(s => s.end === null);
    const liveSession = openSessions.length > 0 ? openSessions[openSessions.length - 1] : null;

    const sessions: Array<[number, number, string]> = [];
    for (const session of paired) {
        if (session.end === null && session !== liveSession) continue;
        const endTs = session.end ? session.end.timestamp : now;
        const s = Math.max(session.start.timestamp, dayStart);
        const e = Math.min(endTs, dayStart + 24 * HOUR_MS);
        if (e > s) sessions.push([s, e, session.start.category || UNCATEGORIZED]);
    }
    return sessions;
}

export function CategoryTimeChart({
    entries,
    categories,
    categoryFilter,
    onToggleCategory,
}: CategoryTimeChartProps) {
    const [now, setNow] = useState(MODULE_LOAD_TIME);

    // Keep the live-session total and current-hour marker fresh without reading
    // an impure clock during render. The zero-delay update also covers cases where
    // this panel mounts long after the application module was first loaded.
    useEffect(() => {
        const updateNow = () => setNow(Date.now());
        const initialTimer = window.setTimeout(updateNow, 0);
        const interval = window.setInterval(updateNow, 60_000);
        return () => {
            window.clearTimeout(initialTimer);
            window.clearInterval(interval);
        };
    }, []);

    const { cells, legend, totalMs, currentHour } = useMemo(() => {
        const day = new Date(now);
        day.setHours(0, 0, 0, 0);
        const dayStart = day.getTime();

        const sessions = todaySessions(entries, dayStart, now);

        // Distribute session time into per-hour, per-category buckets
        const hourBuckets: Array<Map<string, number>> = Array.from({ length: 24 }, () => new Map());
        const dayTotals = new Map<string, number>();
        for (const [s, e, cat] of sessions) {
            dayTotals.set(cat, (dayTotals.get(cat) || 0) + (e - s));
            const firstHour = Math.floor((s - dayStart) / HOUR_MS);
            const lastHour = Math.min(23, Math.floor((e - 1 - dayStart) / HOUR_MS));
            for (let h = firstHour; h <= lastHour; h++) {
                const hs = dayStart + h * HOUR_MS;
                const overlap = Math.min(e, hs + HOUR_MS) - Math.max(s, hs);
                if (overlap > 0) {
                    const bucket = hourBuckets[h];
                    bucket.set(cat, (bucket.get(cat) || 0) + overlap);
                }
            }
        }

        const labelOf = (id: string) => categories.find((c) => c.id === id)?.label || "Unsorted";
        const colorOf = (id: string) => categories.find((c) => c.id === id)?.color || "var(--text-dim)";

        const cells: HourCell[] = hourBuckets.map((bucket, hour) => {
            const ranked = [...bucket.entries()].sort((a, b) => b[1] - a[1]);
            if (ranked.length === 0) {
                return { hour, catId: null, color: "", label: "", coverage: 0, breakdown: [] };
            }
            const [topId] = ranked[0];
            const covered = ranked.reduce((sum, [, ms]) => sum + ms, 0);
            return {
                hour,
                catId: topId,
                color: colorOf(topId),
                label: labelOf(topId),
                coverage: Math.min(1, covered / HOUR_MS),
                breakdown: ranked.map(([id, ms]) => ({ label: labelOf(id), ms })),
            };
        });

        const legend: LegendItem[] = [...dayTotals.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([id, ms]) => ({
                id,
                label: labelOf(id),
                color: colorOf(id),
                ms,
                isCategory: id !== UNCATEGORIZED,
            }));

        const totalMs = [...dayTotals.values()].reduce((a, b) => a + b, 0);
        const currentHour = Math.floor((now - dayStart) / HOUR_MS);

        return { cells, legend, totalMs, currentHour };
    }, [entries, categories, now]);

    return (
        <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--text-dim)" }}>TODAY</span>
                <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-light)" }} />
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                    {totalMs > 0 ? formatHours(totalMs) : "—"}
                </span>
            </div>

            {/* 24-hour grid: 6 per row × 4 rows, one cell per hour */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 28px)", gap: 3, justifyContent: "center" }}>
                {cells.map((cell) => {
                    const filled = cell.catId !== null;
                    const tooltip = filled
                        ? `${String(cell.hour).padStart(2, "0")}:00–${String(cell.hour + 1).padStart(2, "0")}:00 · ` +
                          cell.breakdown.map((b) => `${b.label} ${formatHours(b.ms)}`).join(" · ")
                        : `${String(cell.hour).padStart(2, "0")}:00–${String(cell.hour + 1).padStart(2, "0")}:00`;
                    return (
                        <div
                            key={cell.hour}
                            title={tooltip}
                            style={{
                                position: "relative",
                                width: 28,
                                height: 28,
                                borderRadius: 3,
                                backgroundColor: filled ? cell.color : "var(--heatmap-empty, var(--bg-secondary))",
                                opacity: filled ? 0.35 + 0.65 * cell.coverage : 0.5,
                                border: cell.hour === currentHour ? "1px solid var(--text-dim)" : "1px solid transparent",
                                boxSizing: "border-box",
                                transition: "opacity 120ms ease",
                            }}
                        >
                            <span
                                style={{
                                    position: "absolute",
                                    top: 2,
                                    left: 4,
                                    fontSize: 8,
                                    fontFamily: "var(--font-mono)",
                                    color: "var(--text-dim)",
                                    opacity: 0.8,
                                    pointerEvents: "none",
                                }}
                            >
                                {cell.hour}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Legend: categories active today, click to filter the timeline */}
            {legend.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
                    {legend.map((item) => {
                        const isActive = item.isCategory && categoryFilter.includes(item.id as CategoryId);
                        return (
                            <button
                                key={item.id}
                                onClick={() => item.isCategory && onToggleCategory(item.id as CategoryId)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "4px 8px",
                                    fontSize: 10,
                                    color: isActive ? item.color : "var(--text-secondary)",
                                    backgroundColor: isActive ? `${item.color}20` : "transparent",
                                    border: isActive ? `1px solid ${item.color}40` : "1px solid transparent",
                                    borderRadius: 4,
                                    cursor: item.isCategory ? "pointer" : "default",
                                    textAlign: "left",
                                    transition: "all 100ms ease",
                                }}
                            >
                                <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: item.color, flexShrink: 0 }} />
                                <span style={{ flex: 1, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                    {item.label}
                                </span>
                                <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                                    {formatHours(item.ms)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
