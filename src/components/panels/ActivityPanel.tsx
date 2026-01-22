import { useMemo } from "react";
import { useTheme } from "../../hooks/useTheme";
import styles from "./TasksPanel.module.css";
import type { Entry, Category, CategoryId } from "../../types";

interface HeatmapDay {
    date: Date;
    count: number;
    isToday: boolean;
    isSelected: boolean;
}

interface ActivityPanelProps {
    isOpen: boolean;
    onClose: () => void;
    entries: Entry[];
    categories: Category[];
    selectedDate: Date | null;
    onDateChange: (date: Date | null) => void;
    categoryFilter: CategoryId[];
    onCategoryFilterChange: (filter: CategoryId[]) => void;
}

export function ActivityPanel({
    isOpen,
    onClose,
    entries,
    categories,
    selectedDate,
    onDateChange,
    categoryFilter,
    onCategoryFilterChange,
}: ActivityPanelProps) {
    const { tokens } = useTheme();
    // Generate heatmap data for last 12 weeks
    const heatmapData = useMemo(() => {
        const weeks: HeatmapDay[][] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const counts: Record<string, number> = {};
        entries.forEach((e) => {
            const date = new Date(e.timestamp);
            date.setHours(0, 0, 0, 0);
            const key = date.toDateString();
            counts[key] = (counts[key] || 0) + 1;
        });

        for (let week = 11; week >= 0; week--) {
            const weekData: HeatmapDay[] = [];
            for (let day = 0; day < 7; day++) {
                const date = new Date(today);
                date.setDate(date.getDate() - week * 7 - (6 - day));
                const key = date.toDateString();
                weekData.push({
                    date,
                    count: counts[key] || 0,
                    isToday: date.toDateString() === today.toDateString(),
                    isSelected:
                        selectedDate !== null && date.toDateString() === selectedDate.toDateString(),
                });
            }
            weeks.push(weekData);
        }
        return weeks;
    }, [entries, selectedDate]);

    const getIntensity = (count: number): number => {
        if (count === 0) return 0;
        if (count <= 2) return 1;
        if (count <= 5) return 2;
        if (count <= 10) return 3;
        return 4;
    };

    const getOpacityVar = (intensity: number): string => {
        if (intensity === 0) return '0.5';
        return `var(--heatmap-opacity-${intensity})`;
    };

    const handleCellClick = (date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Clear category filter when clicking heatmap
        if (categoryFilter.length > 0) {
            onCategoryFilterChange([]);
        }
        if (date.toDateString() === today.toDateString()) {
            onDateChange(null);
        } else {
            onDateChange(date);
        }
    };

    const toggleCategory = (catId: CategoryId) => {
        if (categoryFilter.includes(catId)) {
            onCategoryFilterChange(categoryFilter.filter((id) => id !== catId));
        } else {
            onCategoryFilterChange([...categoryFilter, catId]);
        }
    };

    const clearFilter = () => {
        onCategoryFilterChange([]);
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div className={styles.overlay} onClick={onClose} />
            )}

            {/* Panel */}
            <div className={`${styles.panel} ${isOpen ? '' : styles.closed}`} style={{ width: 340 }}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.title}>
                        <span className={styles.titlePrefix}>{tokens.panelTitlePrefix}</span>
                        <span>ACTIVITY</span>
                    </div>
                    <button onClick={onClose} className={styles.closeBtn}>
                        ×
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                    {/* Heatmap Section */}
                    <div style={{ marginBottom: 32 }}>
                        <div className={styles.sectionHeader}>
                            CONTRIBUTION
                            <div className={styles.sectionLine} />
                        </div>
                        <div style={{ display: "flex", gap: 3 }}>
                            {heatmapData.map((week, weekIdx) => (
                                <div
                                    key={weekIdx}
                                    style={{ display: "flex", flexDirection: "column", gap: 3 }}
                                >
                                    {week.map((day, dayIdx) => (
                                        <div
                                            key={dayIdx}
                                            onClick={() => handleCellClick(day.date)}
                                            title={`${day.date.toLocaleDateString()}: ${day.count} entries`}
                                            style={{
                                                width: 18,
                                                height: 18,
                                                borderRadius: 3,
                                                backgroundColor:
                                                    getIntensity(day.count) === 0
                                                        ? "var(--heatmap-empty)"
                                                        : "var(--accent)",
                                                opacity: getOpacityVar(getIntensity(day.count)),
                                                cursor: "pointer",
                                                border: day.isSelected
                                                    ? "2px solid var(--accent)"
                                                    : day.isToday
                                                        ? "1px solid var(--text-dim)"
                                                        : "none",
                                                boxSizing: "border-box",
                                                transition: "all 100ms ease",
                                            }}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                marginTop: 12,
                                fontSize: 9,
                                color: "var(--text-dim)",
                            }}
                        >
                            <span>Less</span>
                            {[0, 1, 2, 3, 4].map((i) => (
                                <div
                                    key={i}
                                    style={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: 2,
                                        backgroundColor:
                                            i === 0 ? "var(--heatmap-empty)" : "var(--accent)",
                                        opacity: getOpacityVar(i),
                                    }}
                                />
                            ))}
                            <span>More</span>
                        </div>
                    </div>

                    {/* Category Filter Section */}
                    <div>
                        <div className={styles.sectionHeader}>
                            <span>FILTER</span>
                            <div className={styles.sectionLine} />
                            {categoryFilter.length > 0 && (
                                <button
                                    onClick={clearFilter}
                                    style={{
                                        fontSize: 9,
                                        color: "var(--text-dim)",
                                        backgroundColor: "transparent",
                                        border: "none",
                                        cursor: "pointer",
                                    }}
                                >
                                    CLEAR
                                </button>
                            )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {categories?.map((cat) => {
                                const isActive = categoryFilter.includes(cat.id);
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => toggleCategory(cat.id)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 10,
                                            padding: "8px 12px",
                                            fontSize: 11,
                                            color: isActive ? cat.color : "var(--text-secondary)",
                                            backgroundColor: isActive
                                                ? `${cat.color}20`
                                                : "var(--bg-secondary)",
                                            border: isActive
                                                ? `1px solid ${cat.color}40`
                                                : "1px solid transparent",
                                            borderRadius: 4,
                                            cursor: "pointer",
                                            textAlign: "left",
                                            transition: "all 100ms ease",
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: 2,
                                                backgroundColor: cat.color,
                                                flexShrink: 0,
                                            }}
                                        />
                                        <span
                                            style={{
                                                textTransform: "uppercase",
                                                letterSpacing: "0.03em",
                                            }}
                                        >
                                            #{cat.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
