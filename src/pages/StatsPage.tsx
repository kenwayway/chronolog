import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSessionContext } from "@/contexts/SessionContext";
import { CategoryTimeChart } from "@/components/panels/CategoryTimeChart";
import { getRollingActivityWindowStart } from "@/components/panels/activityWeek";
import {
    buildStatsSummary,
    getStatsPeriod,
    type DailyTrackedTotal,
    type StatsRangeId,
} from "@/domain/statistics";
import type { CategoryId } from "@/types";
import styles from "./StatsPage.module.css";

const RANGES: { id: StatsRangeId; label: string }[] = [
    { id: "7d", label: "7 DAYS" },
    { id: "30d", label: "30 DAYS" },
    { id: "90d", label: "90 DAYS" },
    { id: "year", label: "THIS YEAR" },
];

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const TIME_BLOCKS = ["00–06", "06–12", "12–18", "18–24"];

interface TrendBucket {
    key: string;
    label: string;
    totalMs: number;
}

function formatDuration(ms: number): string {
    const minutes = Math.round(ms / 60_000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatDelta(current: number, previous: number): string {
    if (previous === 0) return current > 0 ? "NEW VS PREVIOUS" : "NO CHANGE";
    const delta = Math.round(((current - previous) / previous) * 100);
    return `${delta > 0 ? "+" : ""}${delta}% VS PREVIOUS`;
}

function formatPeriod(start: number, end: number): string {
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    const startLabel = new Date(start).toLocaleDateString("en-US", options);
    const endLabel = new Date(end).toLocaleDateString("en-US", options);
    return `${startLabel} — ${endLabel}`;
}

function buildTrendBuckets(days: DailyTrackedTotal[], range: StatsRangeId): TrendBucket[] {
    if (range === "year") {
        const totals = new Map<string, TrendBucket>();
        for (const day of days) {
            const date = new Date(day.dayStart);
            const key = `${date.getFullYear()}-${date.getMonth()}`;
            const existing = totals.get(key);
            if (existing) existing.totalMs += day.totalMs;
            else totals.set(key, {
                key,
                label: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
                totalMs: day.totalMs,
            });
        }
        return [...totals.values()];
    }

    if (range === "90d") {
        const buckets: TrendBucket[] = [];
        for (let index = 0; index < days.length; index += 7) {
            const chunk = days.slice(index, index + 7);
            const date = new Date(chunk[0].dayStart);
            buckets.push({
                key: String(chunk[0].dayStart),
                label: `${date.getMonth() + 1}/${date.getDate()}`,
                totalMs: chunk.reduce((total, day) => total + day.totalMs, 0),
            });
        }
        return buckets;
    }

    return days.map(day => {
        const date = new Date(day.dayStart);
        return {
            key: String(day.dayStart),
            label: range === "7d"
                ? date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()
                : `${date.getMonth() + 1}/${date.getDate()}`,
            totalMs: day.totalMs,
        };
    });
}

export function StatsPage() {
    const navigate = useNavigate();
    const {
        state: { notes, sessions, activeSessionId, contentTypes },
        categories,
    } = useSessionContext();
    const [range, setRange] = useState<StatsRangeId>("30d");
    const [selectedWeekCategories, setSelectedWeekCategories] = useState<CategoryId[]>([]);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    const period = useMemo(() => getStatsPeriod(range, now), [range, now]);
    const summary = useMemo(() => buildStatsSummary({
        notes,
        sessions,
        start: period.start,
        end: period.end,
        now,
        activeSessionId,
    }), [notes, sessions, period, now, activeSessionId]);
    const previous = useMemo(() => buildStatsSummary({
        notes,
        sessions,
        start: period.previousStart,
        end: period.previousEnd,
        now,
        activeSessionId,
    }), [notes, sessions, period, now, activeSessionId]);
    const trend = useMemo(() => buildTrendBuckets(summary.dailyTotals, range), [summary.dailyTotals, range]);
    const rollingWindowStart = useMemo(() => getRollingActivityWindowStart(now), [now]);
    const rollingSummary = useMemo(() => buildStatsSummary({
        notes,
        sessions,
        start: rollingWindowStart,
        end: now,
        now,
        activeSessionId,
    }), [notes, sessions, rollingWindowStart, now, activeSessionId]);

    const categoryById = useMemo(
        () => new Map((categories ?? []).map(category => [category.id, category])),
        [categories],
    );
    const contentTypeById = useMemo(
        () => new Map(contentTypes.map(contentType => [contentType.id, contentType])),
        [contentTypes],
    );
    const maxTrend = Math.max(...trend.map(bucket => bucket.totalMs), 1);
    const maxHeatmap = Math.max(...summary.heatmap.flat(), 1);

    const toggleWeekCategory = (categoryId: CategoryId) => {
        setSelectedWeekCategories(current => current.includes(categoryId)
            ? current.filter(id => id !== categoryId)
            : [...current, categoryId]);
    };

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <button
                    type="button"
                    onClick={() => navigate("/")}
                    className={styles.backBtn}
                    aria-label="Back to timeline"
                    title="Back to timeline"
                >
                    <ArrowLeft size={17} />
                </button>
                <span className={styles.title}>STATS</span>
                <span className={styles.period}>{formatPeriod(period.start, period.end)}</span>
            </header>

            <main className={styles.body}>
                <div className={styles.rangeBar} aria-label="Statistics period">
                    {RANGES.map(option => (
                        <button
                            type="button"
                            key={option.id}
                            className={`${styles.rangeBtn} ${range === option.id ? styles.rangeBtnActive : ""}`}
                            onClick={() => setRange(option.id)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                <section className={styles.metrics} aria-label="Period summary">
                    <div className={styles.metric}>
                        <span className={styles.metricLabel}>TRACKED</span>
                        <strong className={styles.metricValue}>{formatDuration(summary.trackedMs)}</strong>
                        <span className={styles.metricDetail}>{formatDelta(summary.trackedMs, previous.trackedMs)}</span>
                    </div>
                    <div className={styles.metric}>
                        <span className={styles.metricLabel}>SESSIONS</span>
                        <strong className={styles.metricValue}>{summary.sessionCount}</strong>
                        <span className={styles.metricDetail}>{formatDelta(summary.sessionCount, previous.sessionCount)}</span>
                    </div>
                    <div className={styles.metric}>
                        <span className={styles.metricLabel}>NOTES</span>
                        <strong className={styles.metricValue}>{summary.noteCount}</strong>
                        <span className={styles.metricDetail}>{formatDelta(summary.noteCount, previous.noteCount)}</span>
                    </div>
                    <div className={styles.metric}>
                        <span className={styles.metricLabel}>ACTIVE DAYS</span>
                        <strong className={styles.metricValue}>{summary.activeDays}</strong>
                        <span className={styles.metricDetail}>
                            {formatDuration(summary.averageActiveDayMs)} AVG TRACKED
                        </span>
                    </div>
                </section>

                <div className={styles.twoColumn}>
                    <section className={styles.section}>
                        <div className={styles.sectionTitle}>
                            <span>7-DAY TIMELINE</span>
                            <span className={styles.sectionHint}>ROLLING · 06:00 BOUNDARY</span>
                        </div>
                        <div className={styles.sectionBody}>
                            <CategoryTimeChart
                                sessions={sessions}
                                activeSessionId={activeSessionId}
                                categories={categories ?? []}
                                categoryFilter={selectedWeekCategories}
                                onToggleCategory={toggleWeekCategory}
                                showLegend={false}
                            />
                        </div>
                    </section>

                    <section className={styles.section}>
                        <div className={styles.sectionTitle}>
                            <span>7-DAY CATEGORY AVG</span>
                            <span className={styles.sectionHint}>ROLLING WINDOW</span>
                        </div>
                        <div className={styles.weeklyAverage}>
                            {rollingSummary.categoryTotals.length === 0 ? (
                                <div className={styles.empty}>NO TRACKED TIME IN THE LAST 7 DAYS</div>
                            ) : rollingSummary.categoryTotals.map(item => {
                                const category = categoryById.get(item.id as CategoryId);
                                const color = category?.color || "var(--text-dim)";
                                return (
                                    <div className={styles.weeklyAverageRow} key={item.id}>
                                        <span className={styles.breakdownName}>
                                            <i className={styles.swatch} style={{ backgroundColor: color }} />
                                            {category?.label || "Unsorted"}
                                        </span>
                                        <span className={styles.weeklyAverageValue}>
                                            <strong>{formatDuration(item.value / 7)}/day</strong>
                                            <span>{formatDuration(item.value)} total</span>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>

                <div className={styles.twoColumn}>
                    <section className={styles.section}>
                        <div className={styles.sectionTitle}>
                            <span>TRACKED OVER TIME</span>
                            <span className={styles.sectionHint}>{range === "90d" ? "WEEKLY" : range === "year" ? "MONTHLY" : "DAILY"}</span>
                        </div>
                        <div className={styles.trend}>
                            {trend.map((bucket, index) => {
                                const showLabel = trend.length <= 14 || index % 5 === 0 || index === trend.length - 1;
                                return (
                                    <div className={styles.trendColumn} key={bucket.key} title={`${bucket.label} · ${formatDuration(bucket.totalMs)}`}>
                                        <div className={styles.trendTrack}>
                                            <span
                                                className={styles.trendBar}
                                                style={{ height: `${Math.max(bucket.totalMs > 0 ? 2 : 0, (bucket.totalMs / maxTrend) * 100)}%` }}
                                            />
                                        </div>
                                        <span className={styles.trendLabel}>{showLabel ? bucket.label : ""}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <section className={styles.section}>
                        <div className={styles.sectionTitle}>
                            <span>BY CATEGORY</span>
                            <span className={styles.sectionHint}>SELECTED PERIOD</span>
                        </div>
                        <div className={styles.breakdown}>
                            {summary.categoryTotals.length === 0 ? (
                                <div className={styles.empty}>NO TRACKED TIME IN THIS PERIOD</div>
                            ) : summary.categoryTotals.map(item => {
                                const category = categoryById.get(item.id as CategoryId);
                                const color = category?.color || "var(--text-dim)";
                                const percent = summary.trackedMs > 0 ? (item.value / summary.trackedMs) * 100 : 0;
                                return (
                                    <div className={styles.breakdownRow} key={item.id}>
                                        <div className={styles.breakdownMeta}>
                                            <span className={styles.breakdownName}>
                                                <i className={styles.swatch} style={{ backgroundColor: color }} />
                                                {category?.label || "Unsorted"}
                                            </span>
                                            <span>{formatDuration(item.value)} · {Math.round(percent)}%</span>
                                        </div>
                                        <div className={styles.breakdownTrack}>
                                            <span style={{ width: `${percent}%`, backgroundColor: color }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>

                <div className={styles.twoColumn}>
                    <section className={styles.section}>
                        <div className={styles.sectionTitle}>
                            <span>WHEN TIME HAPPENS</span>
                            <span className={styles.sectionHint}>LOCAL TIME</span>
                        </div>
                        <div className={styles.heatmap}>
                            <span />
                            {TIME_BLOCKS.map(block => <span className={styles.heatmapHeader} key={block}>{block}</span>)}
                            {summary.heatmap.map((row, weekday) => (
                                <div className={styles.heatmapRow} key={WEEKDAYS[weekday]}>
                                    <span className={styles.heatmapDay}>{WEEKDAYS[weekday]}</span>
                                    {row.map((value, block) => {
                                        const intensity = value / maxHeatmap;
                                        return (
                                            <span
                                                className={styles.heatmapCell}
                                                key={TIME_BLOCKS[block]}
                                                title={`${WEEKDAYS[weekday]} ${TIME_BLOCKS[block]} · ${formatDuration(value)}`}
                                                style={{
                                                    backgroundColor: value > 0
                                                        ? `color-mix(in srgb, var(--accent) ${Math.round(18 + intensity * 82)}%, var(--bg-secondary))`
                                                        : "var(--bg-secondary)",
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className={styles.section}>
                        <div className={styles.sectionTitle}>
                            <span>RECORDING MIX</span>
                            <span className={styles.sectionHint}>ENTITY COUNT</span>
                        </div>
                        <div className={styles.recordingMix}>
                            {summary.contentTypeTotals.slice(0, 8).map(item => {
                                const contentType = contentTypeById.get(item.id);
                                const label = item.id === "session" ? "Session" : contentType?.name || item.id;
                                return (
                                    <div className={styles.mixRow} key={item.id}>
                                        <span>{contentType?.icon || ">"} {label}</span>
                                        <span>{item.value}</span>
                                    </div>
                                );
                            })}
                            {summary.contentTypeTotals.length === 0 && (
                                <div className={styles.empty}>NO ENTRIES IN THIS PERIOD</div>
                            )}
                        </div>

                        {summary.tagTotals.length > 0 && (
                            <div className={styles.tags}>
                                {summary.tagTotals.slice(0, 10).map(tag => (
                                    <span className={styles.tag} key={tag.id}>#{tag.id} <i>{tag.value}</i></span>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}
