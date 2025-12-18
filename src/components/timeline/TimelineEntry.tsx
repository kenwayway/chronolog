import { useState, memo, useMemo, ReactNode, MouseEvent, TouchEvent } from "react";
import { MapPin } from "lucide-react";
import { ENTRY_TYPES } from "../../utils/constants";
import { formatTime, formatDuration, formatDate } from "../../utils/formatters";
import { parseContent, darkenColor } from "../../utils/contentParser";
import { useTheme } from "../../hooks/useTheme";
import { LinkedEntryPreview } from "./LinkedEntryPreview";
import { BookmarkDisplay, MoodDisplay, WorkoutDisplay } from "./ContentTypeDisplays";
import styles from "./TimelineEntry.module.css";
import type { Entry, Category } from "../../types";

interface Position {
    x: number;
    y: number;
}

interface ContentRendererProps {
    content: string;
}

/**
 * Renders parsed content with proper markdown elements
 */
function ContentRenderer({ content }: ContentRendererProps): ReactNode {
    const parsed = useMemo(() => parseContent(content), [content]);

    return parsed.map((item: any, idx: number) => {
        switch (item.type) {
            case 'codeblock':
                return (
                    <pre key={item.key} className="md-code-block">
                        <code>{item.content as string}</code>
                    </pre>
                );

            case 'image':
                return (
                    <div key={item.key} className="timeline-image-container">
                        <img
                            src={item.content as string}
                            alt="attached"
                            className="timeline-image"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                                ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = "inline";
                            }}
                        />
                        <a
                            href={item.content as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="timeline-image-fallback"
                        >
                            {item.content as string}
                        </a>
                    </div>
                );

            case 'location':
                return (
                    <div
                        key={item.key}
                        style={{
                            marginTop: 4,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        <MapPin size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {item.content as string}
                        </span>
                    </div>
                );

            case 'blockquote':
                return (
                    <blockquote key={item.key} className="md-blockquote">
                        {item.content as string}
                    </blockquote>
                );

            case 'heading': {
                const { level, text } = item.content as { level: number; text: string };
                if (level === 1) {
                    return (
                        <div key={item.key} className="md-h1">
                            <span className="md-h1-deco">═══</span>
                            {text}
                            <span className="md-h1-deco">═══</span>
                        </div>
                    );
                }
                if (level === 2) {
                    return (
                        <div key={item.key} className="md-h2">
                            <span className="md-h2-prefix">»</span>
                            {text}
                        </div>
                    );
                }
                return (
                    <div key={item.key} className="md-h3">
                        <span className="md-h3-prefix">›</span>
                        {text}
                    </div>
                );
            }

            case 'text':
            default:
                return (
                    <span key={item.key}>
                        {item.content as string}
                        {idx < parsed.length - 1 && parsed[idx + 1]?.type === 'text' ? "\n" : ""}
                    </span>
                );
        }
    });
}

type LineState = 'start' | 'end' | 'active' | 'default';

interface TimelineEntryProps {
    entry: Entry;
    allEntries: Entry[];
    isFirst: boolean;
    isLast: boolean;
    sessionDuration?: number;
    categories: Category[];
    onContextMenu?: (entry: Entry, position: Position) => void;
    lineState: LineState | string;
    isLightMode: boolean;
    showDate?: boolean;
    onNavigateToEntry?: (entry: Entry) => void;
}

/**
 * Individual timeline entry component
 * Displays entry content with symbols, categories, and linked entries
 */
export const TimelineEntry = memo(function TimelineEntry({
    entry,
    allEntries,
    isFirst,
    isLast,
    sessionDuration,
    categories,
    onContextMenu,
    lineState,
    isLightMode,
    showDate = false,
    onNavigateToEntry,
}: TimelineEntryProps) {
    const { symbols } = useTheme();
    const [pressTimer, setPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    // Event handlers
    const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        onContextMenu?.(entry, { x: e.clientX, y: e.clientY });
    };

    const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
        e.currentTarget.style.userSelect = 'none';
        (e.currentTarget.style as any).webkitUserSelect = 'none';
        const timer = setTimeout(() => {
            const touch = e.touches[0];
            onContextMenu?.(entry, { x: touch.clientX, y: touch.clientY });
        }, 500);
        setPressTimer(timer);
    };

    const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
        e.currentTarget.style.userSelect = '';
        (e.currentTarget.style as any).webkitUserSelect = '';
        if (pressTimer) {
            clearTimeout(pressTimer);
            setPressTimer(null);
        }
    };

    // Computed values
    const category = useMemo(
        () => categories?.find((c) => c.id === entry.category),
        [categories, entry.category]
    );

    const categoryTextColor = useMemo(
        () => category ? (isLightMode ? darkenColor(category.color, 10) : category.color) : null,
        [category, isLightMode]
    );

    const isSessionStart = entry.type === ENTRY_TYPES.SESSION_START;
    const isSessionEnd = entry.type === ENTRY_TYPES.SESSION_END;
    const isTask = entry.contentType === 'task';
    const isTaskDone = isTask && entry.fieldValues?.done;

    // Linked entries
    const linkedEntryData = useMemo(() => {
        const outgoingLinks = entry.linkedEntries || [];
        const incomingLinks = allEntries
            ?.filter(e => e.id !== entry.id && e.linkedEntries?.includes(entry.id))
            .map(e => e.id) || [];
        const allLinkedIds = [...new Set([...outgoingLinks, ...incomingLinks])];
        return allLinkedIds
            .map(id => allEntries?.find(e => e.id === id))
            .filter((e): e is Entry => Boolean(e));
    }, [entry.id, entry.linkedEntries, allEntries]);

    const beforeLinks = useMemo(
        () => linkedEntryData.filter(e => e.timestamp < entry.timestamp),
        [linkedEntryData, entry.timestamp]
    );

    const afterLinks = useMemo(
        () => linkedEntryData.filter(e => e.timestamp >= entry.timestamp),
        [linkedEntryData, entry.timestamp]
    );

    const getEntrySymbol = (): ReactNode => {
        const styles = { fontSize: 14 };

        if (entry.category === 'beans') {
            return <span style={{ ...styles, color: '#ff9e64' }}>{symbols.beans}</span>;
        }

        if (entry.contentType === 'task') {
            const isDone = entry.fieldValues?.done;
            if (isDone) {
                return <span style={{ ...styles, color: "var(--success)", fontWeight: 700 }}>{symbols.done}</span>;
            }
            return <span style={{ ...styles, color: "var(--warning)" }}>{symbols.todo}</span>;
        }

        switch (entry.type) {
            case ENTRY_TYPES.SESSION_START:
                return <span style={{ ...styles, color: "var(--success)", fontWeight: 700, fontSize: 14 }}>{symbols.sessionStart}</span>;
            case ENTRY_TYPES.SESSION_END:
                return <span style={{ ...styles, color: "var(--text-muted)" }}>{symbols.sessionEnd}</span>;
            case ENTRY_TYPES.NOTE:
            default:
                return <span style={{ ...styles, color: "var(--text-dim)" }}>{symbols.note}</span>;
        }
    };

    const getLineColor = (position: "top" | "bottom"): string => {
        if (position === "top") {
            return lineState === "start" || lineState === "default" ? "var(--border-light)" : "var(--accent)";
        }
        return lineState === "end" || lineState === "default" ? "var(--border-light)" : "var(--accent)";
    };

    const getContentColor = (): string => {
        if (isSessionStart) return "var(--text-primary)";
        if (isSessionEnd) return "var(--text-muted)";
        if (isTaskDone) return "var(--text-muted)";
        if (isTask) return "var(--warning)";
        return "var(--text-secondary)";
    };

    return (
        <div
            className={`${styles.entry} ${isTaskDone ? styles.entryDone : ''}`}
            data-entry-id={entry.id}
            style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
                cursor: "default",
                userSelect: "none",
                transition: "background-color 300ms ease",
            }}
            onContextMenu={handleContextMenu}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
        >
            {/* Time Column */}
            <div
                className={styles.timeCol}
                style={{
                    flexShrink: 0,
                    width: 50,
                    textAlign: "right",
                    fontSize: 10,
                    color: "var(--text-dim)",
                    paddingRight: 8,
                    paddingTop: 4,
                    fontFamily: "var(--font-mono)",
                    opacity: 0.6,
                }}
            >
                {showDate && (
                    <div style={{ marginBottom: 2, fontSize: 9, color: "var(--text-muted)" }}>
                        {formatDate(new Date(entry.timestamp).getTime())}
                    </div>
                )}
                {formatTime(entry.timestamp)}
                {/* Duration under timestamp for session start */}
                {isSessionStart && sessionDuration && (
                    <div
                        style={{
                            marginTop: 4,
                            fontSize: 9,
                            color: "var(--accent)",
                            fontWeight: 500,
                        }}
                    >
                        {formatDuration(sessionDuration)}
                    </div>
                )}
            </div>

            {/* Symbol Column */}
            <div
                className={styles.symbolCol}
                style={{
                    position: "relative",
                    flexShrink: 0,
                    width: 20,
                    textAlign: "center",
                    fontSize: 14,
                    userSelect: "none",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    alignSelf: "stretch",
                }}
            >
                {!isFirst && (
                    <div
                        style={{
                            position: "absolute",
                            top: -12,
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: 1,
                            height: 24,
                            backgroundColor: getLineColor("top"),
                        }}
                    />
                )}
                {!isLast && (
                    <div
                        style={{
                            position: "absolute",
                            top: 12,
                            bottom: -12,
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: 1,
                            backgroundColor: getLineColor("bottom"),
                        }}
                    />
                )}
                <div
                    style={{
                        position: "relative",
                        zIndex: 10,
                        width: 20,
                        height: 20,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 9999,
                        backgroundColor: "var(--bg-primary)",
                    }}
                >
                    {getEntrySymbol()}
                </div>
            </div>

            {/* Content */}
            <div className={styles.contentCol} style={{ flex: 1, minWidth: 0 }}>
                {/* Linked entries before (older) */}
                {beforeLinks.length > 0 && (
                    <div className="linked-entries-before" style={{ marginBottom: 8 }}>
                        {beforeLinks.map(linked => (
                            <LinkedEntryPreview
                                key={linked.id}
                                linkedEntry={linked}
                                direction="before"
                                onNavigateToEntry={onNavigateToEntry}
                            />
                        ))}
                    </div>
                )}

                {/* Mobile timestamp */}
                <div
                    className={styles.mobileTime}
                    style={{
                        fontSize: 10,
                        color: "var(--text-dim)",
                        fontFamily: "var(--font-mono)",
                        marginBottom: 4,
                        display: "none",
                    }}
                >
                    {formatTime(entry.timestamp)}
                </div>

                {/* Main content row */}
                <div className="flex flex-wrap items-baseline" style={{ gap: "4px 12px", marginBottom: 6 }}>
                    {entry.content && (
                        <span
                            className={styles.contentText}
                            style={{
                                fontSize: 15,
                                lineHeight: 1.6,
                                overflowWrap: "break-word",
                                fontFamily: "var(--font-primary)",
                                whiteSpace: "pre-wrap",
                                color: getContentColor(),
                                fontStyle: isSessionEnd ? "italic" : "normal",
                                textDecoration: isTaskDone ? "line-through" : "none",
                            }}
                        >
                            <ContentRenderer content={entry.content} />
                        </span>
                    )}

                    {isTaskDone && (
                        <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 700, userSelect: "none" }}>
                            {"[DONE]" as any}
                        </span>
                    )}

                    {isTask && !isTaskDone && (
                        <span style={{ fontSize: 11, color: "var(--warning)", fontWeight: 700, userSelect: "none" }}>
                            [TODO]
                        </span>
                    )}

                </div>

                {/* Content type displays */}
                {entry.contentType === 'bookmark' && (
                    <div style={{ marginTop: 6 }}>
                        <BookmarkDisplay fieldValues={entry.fieldValues} />
                    </div>
                )}
                {entry.contentType === 'mood' && (
                    <div style={{ marginTop: 6 }}>
                        <MoodDisplay fieldValues={entry.fieldValues} />
                    </div>
                )}
                {entry.contentType === 'workout' && (
                    <WorkoutDisplay fieldValues={entry.fieldValues} />
                )}

                {/* Metadata Footer (Tags & Category) */}
                {(category || (entry.tags && entry.tags.length > 0)) && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginTop: 8,
                        gap: 8,
                        minHeight: 20,
                    }}>
                        {/* Category - Left aligned */}
                        {category && (
                            <span
                                className="category-label"
                                style={{
                                    fontSize: 10,
                                    padding: "2px 8px",
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    userSelect: "none",
                                    letterSpacing: "0.05em",
                                    color: categoryTextColor || undefined,
                                    backgroundColor: `${category.color}15`,
                                    border: `1px solid ${category.color}30`,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {category.label}
                            </span>
                        )}

                        {/* Tags - Left aligned next to category */}
                        <div style={{
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            color: "var(--accent)",
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 6,
                        }}>
                            {entry.tags?.map(tag => (
                                <span key={tag}>#{tag}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Linked entries after (newer) */}
                {afterLinks.length > 0 && (
                    <div className="linked-entries-after" style={{ marginTop: 8 }}>
                        {afterLinks.map(linked => (
                            <LinkedEntryPreview
                                key={linked.id}
                                linkedEntry={linked}
                                direction="after"
                                onNavigateToEntry={onNavigateToEntry}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});
