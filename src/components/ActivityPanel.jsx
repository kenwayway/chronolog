import { useMemo } from "react";

export function ActivityPanel({
    isOpen,
    onClose,
    entries,
    categories,
    selectedDate,
    onDateChange,
    categoryFilter,
    onCategoryFilterChange,
}) {
    // Generate heatmap data for last 12 weeks
    const heatmapData = useMemo(() => {
        const weeks = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Count entries per day
        const counts = {};
        entries.forEach((e) => {
            const date = new Date(e.timestamp);
            date.setHours(0, 0, 0, 0);
            const key = date.toDateString();
            counts[key] = (counts[key] || 0) + 1;
        });

        // Build 12 weeks of data (84 days)
        for (let week = 11; week >= 0; week--) {
            const weekData = [];
            for (let day = 0; day < 7; day++) {
                const date = new Date(today);
                date.setDate(date.getDate() - week * 7 - (6 - day));
                const key = date.toDateString();
                weekData.push({
                    date,
                    count: counts[key] || 0,
                    isToday: date.toDateString() === today.toDateString(),
                    isSelected:
                        selectedDate && date.toDateString() === selectedDate.toDateString(),
                });
            }
            weeks.push(weekData);
        }
        return weeks;
    }, [entries, selectedDate]);

    const getIntensity = (count) => {
        if (count === 0) return 0;
        if (count <= 2) return 1;
        if (count <= 5) return 2;
        if (count <= 10) return 3;
        return 4;
    };

    const handleCellClick = (date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date.toDateString() === today.toDateString()) {
            onDateChange(null);
        } else {
            onDateChange(date);
        }
    };

    const toggleCategory = (catId) => {
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
                <div
                    onClick={onClose}
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        backdropFilter: "blur(4px)",
                        zIndex: 400,
                    }}
                />
            )}

            {/* Panel */}
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: 320,
                    maxWidth: "100vw",
                    backgroundColor: "var(--bg-glass)",
                    backdropFilter: "blur(24px)",
                    borderLeft: "1px solid var(--border-light)",
                    zIndex: 401,
                    display: "flex",
                    flexDirection: "column",
                    transform: isOpen ? "translateX(0)" : "translateX(100%)",
                    transition: "transform 300ms ease-out",
                    boxShadow: "-10px 0 30px rgba(0,0,0,0.3)",
                    fontFamily: "'JetBrains Mono', monospace",
                }}
            >
                {/* Header */}
                <div
                    className="flex-between"
                    style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-primary)",
                    }}
                >
                    <div
                        className="flex items-center gap-3"
                        style={{ fontSize: 12, color: "var(--text-muted)" }}
                    >
                        <span style={{ color: "var(--text-dim)", opacity: 0.5 }}>::</span>
                        <span className="uppercase tracking-wider font-bold">ACTIVITY</span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            color: "var(--text-muted)",
                            backgroundColor: "transparent",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 18,
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                    {/* Heatmap Section */}
                    <div style={{ marginBottom: 32 }}>
                        <div
                            style={{
                                fontSize: 10,
                                color: "var(--text-dim)",
                                marginBottom: 12,
                                letterSpacing: "0.05em",
                            }}
                        >
                            CONTRIBUTION
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
                                                        ? "var(--bg-tertiary)"
                                                        : "var(--accent)",
                                                opacity:
                                                    getIntensity(day.count) === 0
                                                        ? 0.3
                                                        : 0.2 + getIntensity(day.count) * 0.2,
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
                                        backgroundColor: i === 0 ? "var(--bg-tertiary)" : "var(--accent)",
                                        opacity: i === 0 ? 0.3 : 0.2 + i * 0.2,
                                    }}
                                />
                            ))}
                            <span>More</span>
                        </div>
                    </div>

                    {/* Category Filter Section */}
                    <div>
                        <div
                            className="flex-between"
                            style={{
                                fontSize: 10,
                                color: "var(--text-dim)",
                                marginBottom: 12,
                                letterSpacing: "0.05em",
                            }}
                        >
                            <span>FILTER</span>
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
                                        <span style={{ textTransform: "uppercase", letterSpacing: "0.03em" }}>
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
