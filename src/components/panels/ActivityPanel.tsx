import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useSessionContext } from "@/contexts/SessionContext";
import { extractAllTags } from "@/utils/tagParser";
import styles from "./TasksPanel.module.css";
import type { CategoryId } from "@/types";

interface HeatmapDay {
    date: Date;
    count: number;
    isToday: boolean;
    isSelected: boolean;
}

interface ActivityPanelProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date | null;
    onDateChange: (date: Date | null) => void;
    categoryFilter: CategoryId[];
    onCategoryFilterChange: (filter: CategoryId[]) => void;
    tagFilter: string[];
    onTagFilterChange: (filter: string[]) => void;
    contentTypeFilter: string[];
    onContentTypeFilterChange: (filter: string[]) => void;
}

export function ActivityPanel({
    isOpen,
    onClose,
    selectedDate,
    onDateChange,
    categoryFilter,
    onCategoryFilterChange,
    tagFilter,
    onTagFilterChange,
    contentTypeFilter,
    onContentTypeFilterChange,
}: ActivityPanelProps) {
    const { state: { entries, contentTypes }, categories } = useSessionContext();
    const { tokens } = useTheme();

    // Tag statistics
    const tagStats = useMemo(() => extractAllTags(entries), [entries]);
    const TAG_PREVIEW_COUNT = 20;

    // Content type statistics
    const contentTypeStats = useMemo(() => {
        const counts: Record<string, number> = {};
        entries.forEach(e => {
            if (e.contentType && e.contentType !== 'note') {
                counts[e.contentType] = (counts[e.contentType] || 0) + 1;
            }
        });
        if (!contentTypes) return [];
        return contentTypes
            .filter(ct => ct.id !== 'note' && (counts[ct.id] || 0) > 0)
            .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
            .map(ct => ({ ...ct, count: counts[ct.id] }));
    }, [entries, contentTypes]);
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
        if (contentTypeFilter.length > 0) {
            onContentTypeFilterChange([]);
        }
        if (date.toDateString() === today.toDateString()) {
            onDateChange(null);
        } else {
            onDateChange(date);
        }
    };

    const toggleCategory = (catId: CategoryId) => {
        if (tagFilter.length > 0) onTagFilterChange([]);
        if (contentTypeFilter.length > 0) onContentTypeFilterChange([]);
        if (categoryFilter.includes(catId)) {
            onCategoryFilterChange(categoryFilter.filter((id) => id !== catId));
        } else {
            onCategoryFilterChange([...categoryFilter, catId]);
        }
    };

    const clearFilter = () => {
        onCategoryFilterChange([]);
        onContentTypeFilterChange([]);
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
                            {(categoryFilter.length > 0 || contentTypeFilter.length > 0) && (
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

                    {/* Content Type Filter Section */}
                    {contentTypeStats.length > 0 && (
                        <div style={{ marginTop: 32 }}>
                            <div className={styles.sectionHeader}>
                                <span>TYPES</span>
                                <div className={styles.sectionLine} />
                                {contentTypeFilter.length > 0 && (
                                    <button
                                        onClick={() => onContentTypeFilterChange([])}
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
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {contentTypeStats.map(ct => {
                                    const isActive = contentTypeFilter.includes(ct.id);
                                    return (
                                        <button
                                            key={ct.id}
                                            onClick={() => {
                                                if (categoryFilter.length > 0) onCategoryFilterChange([]);
                                                if (tagFilter.length > 0) onTagFilterChange([]);
                                                if (isActive) {
                                                    onContentTypeFilterChange(contentTypeFilter.filter(id => id !== ct.id));
                                                } else {
                                                    onContentTypeFilterChange([...contentTypeFilter, ct.id]);
                                                }
                                            }}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 4,
                                                padding: "4px 10px",
                                                fontSize: 10,
                                                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                                                backgroundColor: isActive
                                                    ? "var(--accent-subtle, rgba(99,102,241,0.12))"
                                                    : "var(--bg-secondary)",
                                                border: isActive
                                                    ? "1px solid var(--accent)"
                                                    : "1px solid transparent",
                                                borderRadius: 4,
                                                cursor: "pointer",
                                                transition: "all 100ms ease",
                                            }}
                                        >
                                            <span>{ct.icon || ct.name.charAt(0).toUpperCase()}</span>
                                            <span style={{ textTransform: "uppercase", letterSpacing: "0.03em" }}>
                                                {ct.name}
                                            </span>
                                            <span style={{ fontSize: 8, opacity: 0.6 }}>
                                                {ct.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Tag Filter Section */}
                    {tagStats.length > 0 && (
                        <div style={{ marginTop: 32 }}>
                            <div className={styles.sectionHeader}>
                                <span>TAGS</span>
                                <div className={styles.sectionLine} />
                                {tagFilter.length > 0 && (
                                    <button
                                        onClick={() => onTagFilterChange([])}
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
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {tagStats.slice(0, TAG_PREVIEW_COUNT).map(({ tag, count }) => {
                                    const isActive = tagFilter.includes(tag);
                                    return (
                                        <button
                                            key={tag}
                                            onClick={() => {
                                                if (categoryFilter.length > 0) onCategoryFilterChange([]);
                                                if (contentTypeFilter.length > 0) onContentTypeFilterChange([]);
                                                if (isActive) {
                                                    onTagFilterChange(tagFilter.filter(t => t !== tag));
                                                } else {
                                                    onTagFilterChange([...tagFilter, tag]);
                                                }
                                            }}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 4,
                                                padding: "4px 10px",
                                                fontSize: 10,
                                                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                                                backgroundColor: isActive
                                                    ? "var(--accent-subtle, rgba(99,102,241,0.12))"
                                                    : "var(--bg-secondary)",
                                                border: isActive
                                                    ? "1px solid var(--accent)"
                                                    : "1px solid transparent",
                                                borderRadius: 4,
                                                cursor: "pointer",
                                                transition: "all 100ms ease",
                                            }}
                                        >
                                            <span>#{tag}</span>
                                            <span style={{
                                                fontSize: 8,
                                                opacity: 0.6,
                                            }}>
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Library Section */}
                    <div style={{ marginTop: 32 }}>
                        <div className={styles.sectionHeader}>
                            <span>LIBRARY</span>
                            <div className={styles.sectionLine} />
                        </div>
                        <Link
                            to="/library"
                            onClick={onClose}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 12px',
                                fontSize: 11,
                                color: 'var(--text-secondary)',
                                backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid transparent',
                                borderRadius: 4,
                                textDecoration: 'none',
                                cursor: 'pointer',
                                transition: 'all 100ms ease',
                            }}
                        >
                            <BookOpen size={14} style={{ flexShrink: 0 }} />
                            <span style={{ textTransform: 'uppercase', letterSpacing: '0.03em', flex: 1 }}>
                                Media Library
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                                {entries.filter(e => e.contentType === 'media').length > 0
                                    ? `→`
                                    : '→'}
                            </span>
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
