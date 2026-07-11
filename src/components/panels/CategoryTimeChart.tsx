import { useMemo, useState } from "react";
import { ENTRY_TYPES } from "@/utils/constants";
import type { Category, CategoryId, Entry } from "@/types";

interface CategoryTimeChartProps {
    entries: Entry[];
    categories: Category[];
    categoryFilter: CategoryId[];
    onToggleCategory: (catId: CategoryId) => void;
}

type Period = "7d" | "30d";

const PERIOD_MS: Record<Period, number> = {
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
};

const UNCATEGORIZED = "__uncategorized__";

// Fixed slice order chosen so visually confusable colors are never adjacent
// (hustle-blue vs craft-purple, hardware-green vs barter-yellow-green).
const SLICE_ORDER = ["hustle", "barter", "craft", "hardware", "wander", "work", UNCATEGORIZED];

interface Slice {
    id: string;
    label: string;
    color: string;
    ms: number;
    fraction: number;
    isCategory: boolean;
}

/** Sum session durations per category within the time window (includes the live session). */
function computeCategoryTime(entries: Entry[], windowMs: number): Map<string, number> {
    const cutoff = Date.now() - windowMs;
    const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
    const totals = new Map<string, number>();

    let startTs: number | null = null;
    let startCat: string | null = null;

    const attribute = (endTs: number) => {
        if (startTs === null || endTs <= cutoff) return;
        const key = startCat || UNCATEGORIZED;
        totals.set(key, (totals.get(key) || 0) + (endTs - Math.max(startTs, cutoff)));
    };

    for (const entry of sorted) {
        if (entry.type === ENTRY_TYPES.SESSION_START) {
            startTs = entry.timestamp;
            startCat = entry.category || null;
        } else if (entry.type === ENTRY_TYPES.SESSION_END && startTs !== null) {
            attribute(entry.timestamp);
            startTs = null;
            startCat = null;
        }
    }
    // Ongoing session counts up to now
    attribute(Date.now());

    return totals;
}

function formatHours(ms: number): string {
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Donut segment path with angular padding so the surface shows through between slices. */
function arcPath(cx: number, cy: number, rOuter: number, rInner: number, start: number, end: number): string {
    const p = (r: number, a: number) => `${cx + r * Math.sin(a)} ${cy - r * Math.cos(a)}`;
    const large = end - start > Math.PI ? 1 : 0;
    return [
        `M ${p(rOuter, start)}`,
        `A ${rOuter} ${rOuter} 0 ${large} 1 ${p(rOuter, end)}`,
        `L ${p(rInner, end)}`,
        `A ${rInner} ${rInner} 0 ${large} 0 ${p(rInner, start)}`,
        "Z",
    ].join(" ");
}

export function CategoryTimeChart({
    entries,
    categories,
    categoryFilter,
    onToggleCategory,
}: CategoryTimeChartProps) {
    const [period, setPeriod] = useState<Period>("7d");
    const [hovered, setHovered] = useState<string | null>(null);

    const { slices, totalMs } = useMemo(() => {
        const totals = computeCategoryTime(entries, PERIOD_MS[period]);
        const total = [...totals.values()].reduce((a, b) => a + b, 0);
        const result: Slice[] = SLICE_ORDER.flatMap((id) => {
            const ms = totals.get(id) || 0;
            if (ms <= 0) return [];
            const cat = categories.find((c) => c.id === id);
            return [{
                id,
                label: cat?.label || "Unsorted",
                color: cat?.color || "var(--text-dim)",
                ms,
                fraction: ms / total,
                isCategory: !!cat,
            }];
        });
        return { slices: result, totalMs: total };
    }, [entries, categories, period]);

    // Geometry
    const SIZE = 170;
    const CX = SIZE / 2;
    const R_OUTER = 78;
    const R_INNER = 52;

    const arcs = useMemo(() => {
        const pad = slices.length > 1 ? 2 / R_OUTER : 0; // ~2px surface gap at the rim
        const sweeps = slices.map((s) => s.fraction * Math.PI * 2);
        return slices.map((s, i) => {
            const offset = sweeps.slice(0, i).reduce((a, b) => a + b, 0);
            const start = offset + pad / 2;
            const end = offset + sweeps[i] - pad / 2;
            // Degenerate sliver: still render a hairline so the legend never orphans
            const path = end > start
                ? arcPath(CX, CX, R_OUTER, R_INNER, start, end)
                : arcPath(CX, CX, R_OUTER, R_INNER, offset, offset + sweeps[i]);
            return { ...s, path };
        });
    }, [slices, CX]);

    const dimOthers = hovered !== null;

    return (
        <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--text-dim)" }}>TIME</span>
                <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-light)" }} />
                {(["7d", "30d"] as const).map((p) => (
                    <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        style={{
                            fontSize: 9,
                            letterSpacing: "0.08em",
                            padding: "2px 6px",
                            color: period === p ? "var(--accent)" : "var(--text-dim)",
                            backgroundColor: period === p ? "var(--accent-subtle, rgba(99,102,241,0.12))" : "transparent",
                            border: period === p ? "1px solid var(--accent)" : "1px solid transparent",
                            borderRadius: 3,
                            cursor: "pointer",
                        }}
                    >
                        {p.toUpperCase()}
                    </button>
                ))}
            </div>

            {slices.length === 0 ? (
                <div style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center", padding: "24px 0" }}>
                    该时段暂无会话记录
                </div>
            ) : (
                <>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="分类时间分布">
                            {arcs.map((a) => (
                                <path
                                    key={a.id}
                                    d={a.path}
                                    fill={a.color}
                                    opacity={dimOthers && hovered !== a.id ? 0.35 : 1}
                                    style={{ cursor: a.isCategory ? "pointer" : "default", transition: "opacity 120ms ease" }}
                                    onMouseEnter={() => setHovered(a.id)}
                                    onMouseLeave={() => setHovered(null)}
                                    onClick={() => a.isCategory && onToggleCategory(a.id as CategoryId)}
                                >
                                    <title>{`${a.label}: ${formatHours(a.ms)} (${Math.round(a.fraction * 100)}%)`}</title>
                                </path>
                            ))}
                            <text
                                x={CX}
                                y={CX - 4}
                                textAnchor="middle"
                                style={{ fontSize: 20, fontFamily: "var(--font-mono)", fill: "var(--text-primary)" }}
                            >
                                {formatHours(hovered ? (arcs.find(a => a.id === hovered)?.ms ?? totalMs) : totalMs)}
                            </text>
                            <text
                                x={CX}
                                y={CX + 14}
                                textAnchor="middle"
                                style={{ fontSize: 9, letterSpacing: "0.1em", fill: "var(--text-dim)" }}
                            >
                                {hovered
                                    ? (arcs.find(a => a.id === hovered)?.label ?? "").toUpperCase()
                                    : period === "7d" ? "LAST 7 DAYS" : "LAST 30 DAYS"}
                            </text>
                        </svg>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
                        {arcs.map((a) => {
                            const isActive = a.isCategory && categoryFilter.includes(a.id as CategoryId);
                            const isHovered = hovered === a.id;
                            return (
                                <button
                                    key={a.id}
                                    onClick={() => a.isCategory && onToggleCategory(a.id as CategoryId)}
                                    onMouseEnter={() => setHovered(a.id)}
                                    onMouseLeave={() => setHovered(null)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "4px 8px",
                                        fontSize: 10,
                                        color: isActive ? a.color : "var(--text-secondary)",
                                        backgroundColor: isActive
                                            ? `${a.color}20`
                                            : isHovered ? "var(--bg-secondary)" : "transparent",
                                        border: isActive ? `1px solid ${a.color}40` : "1px solid transparent",
                                        borderRadius: 4,
                                        cursor: a.isCategory ? "pointer" : "default",
                                        textAlign: "left",
                                        transition: "all 100ms ease",
                                    }}
                                >
                                    <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: a.color, flexShrink: 0 }} />
                                    <span style={{ flex: 1, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                        {a.label}
                                    </span>
                                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                                        {formatHours(a.ms)}
                                    </span>
                                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)", width: 32, textAlign: "right" }}>
                                        {Math.round(a.fraction * 100)}%
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
