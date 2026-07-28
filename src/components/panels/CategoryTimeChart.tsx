import { useEffect, useMemo, useState } from "react";
import type { Category, CategoryId, Session } from "@/types";
import { getActivityWeekStart } from "./activityWeek";
import styles from "./CategoryTimeChart.module.css";

interface CategoryTimeChartProps {
    sessions: Session[];
    activeSessionId: string | null;
    categories: Category[];
    categoryFilter: CategoryId[];
    onToggleCategory: (catId: CategoryId) => void;
}

const UNCATEGORIZED = "__uncategorized__";
const MODULE_LOAD_TIME = Date.now();
const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

interface ActivitySegment {
    id: string;
    categoryId: string;
    color: string;
    top: number;
    height: number;
    tooltip: string;
}

interface DayColumn {
    key: number;
    label: string;
    dateLabel: string;
    segments: ActivitySegment[];
    currentPosition: number | null;
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
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
        ? `${hours}h ${remainingMinutes}m`
        : `${hours}h`;
}

function formatClock(timestamp: number): string {
    const date = new Date(timestamp);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getDayWindow(weekStart: number, dayIndex: number): [number, number] {
    const start = new Date(weekStart);
    start.setDate(start.getDate() + dayIndex);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return [start.getTime(), end.getTime()];
}

export function CategoryTimeChart({
    sessions,
    activeSessionId,
    categories,
    categoryFilter,
    onToggleCategory,
}: CategoryTimeChartProps) {
    const [now, setNow] = useState(MODULE_LOAD_TIME);

    useEffect(() => {
        const updateNow = () => setNow(Date.now());
        const initialTimer = window.setTimeout(updateNow, 0);
        const interval = window.setInterval(updateNow, 60_000);
        return () => {
            window.clearTimeout(initialTimer);
            window.clearInterval(interval);
        };
    }, []);

    const { days, legend, totalMs } = useMemo(() => {
        const weekStart = getActivityWeekStart(now);
        const [, weekEnd] = getDayWindow(weekStart, 6);
        const categoryById = new Map(categories.map(category => [category.id, category]));
        const labelOf = (id: string) => categoryById.get(id as CategoryId)?.label || "Unsorted";
        const colorOf = (id: string) => categoryById.get(id as CategoryId)?.color || "var(--text-dim)";

        const intervals = sessions.flatMap(session => {
            if (session.origin === "zaddy") return [];
            if (session.endAt === null && session.id !== activeSessionId) return [];
            const end = session.endAt ?? now;
            if (end <= weekStart || session.startAt >= weekEnd) return [];
            return [{
                id: session.id,
                start: Math.max(session.startAt, weekStart),
                end: Math.min(end, weekEnd),
                categoryId: session.category || UNCATEGORIZED,
            }];
        });

        const totals = new Map<string, number>();
        for (const interval of intervals) {
            totals.set(
                interval.categoryId,
                (totals.get(interval.categoryId) || 0) + (interval.end - interval.start),
            );
        }

        const days: DayColumn[] = DAY_LABELS.map((label, dayIndex) => {
            const [dayStart, dayEnd] = getDayWindow(weekStart, dayIndex);
            const duration = dayEnd - dayStart;
            const date = new Date(dayStart);
            const segments = intervals.flatMap(interval => {
                const start = Math.max(interval.start, dayStart);
                const end = Math.min(interval.end, dayEnd);
                if (end <= start) return [];
                return [{
                    id: `${interval.id}-${dayIndex}-${start}`,
                    categoryId: interval.categoryId,
                    color: colorOf(interval.categoryId),
                    top: ((start - dayStart) / duration) * 100,
                    height: ((end - start) / duration) * 100,
                    tooltip: `${label} ${date.getMonth() + 1}/${date.getDate()} · ${formatClock(start)}–${formatClock(end)} · ${labelOf(interval.categoryId)} · ${formatHours(end - start)}`,
                }];
            });

            return {
                key: dayStart,
                label,
                dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
                segments,
                currentPosition: now >= dayStart && now < dayEnd
                    ? ((now - dayStart) / duration) * 100
                    : null,
            };
        });

        const legend: LegendItem[] = [...totals.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([id, ms]) => ({
                id,
                label: labelOf(id),
                color: colorOf(id),
                ms,
                isCategory: id !== UNCATEGORIZED,
            }));

        return {
            days,
            legend,
            totalMs: [...totals.values()].reduce((sum, value) => sum + value, 0),
        };
    }, [sessions, activeSessionId, categories, now]);

    return (
        <section className={styles.chart} aria-label="This week's activity by category">
            <div className={styles.sectionHeader}>
                <span>THIS WEEK</span>
                <div className={styles.sectionLine} />
                <span className={styles.total}>{totalMs > 0 ? formatHours(totalMs) : "—"}</span>
            </div>

            <div className={styles.weekGrid}>
                <div aria-hidden="true" />
                {days.map(day => (
                    <div className={styles.dayHeader} key={`header-${day.key}`}>
                        <span>{day.label}</span>
                        <span className={styles.dateLabel}>{day.dateLabel}</span>
                    </div>
                ))}

                <div className={styles.timeAxis} aria-hidden="true">
                    {[
                        ["06", 0],
                        ["12", 25],
                        ["18", 50],
                        ["00", 75],
                        ["06", 100],
                    ].map(([label, position]) => (
                        <span
                            key={`${label}-${position}`}
                            className={styles.timeLabel}
                            style={{ top: `${position}%` }}
                        >
                            {label}
                        </span>
                    ))}
                </div>

                {days.map(day => (
                    <div className={styles.dayTrack} key={day.key}>
                        {[0, 25, 50, 75, 100].map(position => (
                            <span
                                aria-hidden="true"
                                className={styles.gridLine}
                                key={position}
                                style={{ top: `${position}%` }}
                            />
                        ))}
                        {day.segments.map(segment => {
                            const isSelected = segment.categoryId !== UNCATEGORIZED
                                && categoryFilter.includes(segment.categoryId as CategoryId);
                            const isDimmed = categoryFilter.length > 0 && !isSelected;
                            return (
                                <span
                                    className={`${styles.segment} ${isSelected ? styles.selectedSegment : ""} ${isDimmed ? styles.dimmedSegment : ""}`}
                                    key={segment.id}
                                    title={segment.tooltip}
                                    style={{
                                        top: `${segment.top}%`,
                                        height: `${segment.height}%`,
                                        backgroundColor: segment.color,
                                    }}
                                />
                            );
                        })}
                        {day.currentPosition !== null && (
                            <span
                                aria-label="Current time"
                                className={styles.currentTime}
                                style={{ top: `${day.currentPosition}%` }}
                            />
                        )}
                    </div>
                ))}
            </div>

            {legend.length > 0 && (
                <div className={styles.legend}>
                    {legend.map(item => {
                        const isActive = item.isCategory
                            && categoryFilter.includes(item.id as CategoryId);
                        return (
                            <button
                                className={`${styles.legendItem} ${isActive ? styles.activeLegendItem : ""}`}
                                key={item.id}
                                onClick={() => item.isCategory && onToggleCategory(item.id as CategoryId)}
                                style={{
                                    color: isActive ? item.color : undefined,
                                    backgroundColor: isActive ? `${item.color}20` : undefined,
                                    borderColor: isActive ? `${item.color}40` : undefined,
                                    cursor: item.isCategory ? "pointer" : "default",
                                }}
                            >
                                <span className={styles.legendSwatch} style={{ backgroundColor: item.color }} />
                                <span className={styles.legendLabel}>{item.label}</span>
                                <span className={styles.legendDuration}>{formatHours(item.ms)}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
