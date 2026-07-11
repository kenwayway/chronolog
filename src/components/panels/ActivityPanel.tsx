import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Images } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useSessionContext } from "@/contexts/SessionContext";
import { extractAllTags } from "@/utils/tagParser";
import { CategoryTimeChart } from "./CategoryTimeChart";
import styles from "./ActivityPanel.module.css";
import type { CategoryId } from "@/types";

interface ActivityPanelProps {
    isOpen: boolean;
    onClose: () => void;
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
                    {/* Category Time Distribution */}
                    <CategoryTimeChart
                        entries={entries}
                        categories={categories ?? []}
                        categoryFilter={categoryFilter}
                        onToggleCategory={toggleCategory}
                    />

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
                            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>→</span>
                        </Link>
                        <Link
                            to="/gallery"
                            onClick={onClose}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 12px',
                                marginTop: 6,
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
                            <Images size={14} style={{ flexShrink: 0 }} />
                            <span style={{ textTransform: 'uppercase', letterSpacing: '0.03em', flex: 1 }}>
                                Gallery
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>→</span>
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
