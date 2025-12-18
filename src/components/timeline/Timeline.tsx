import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { ENTRY_TYPES } from "../../utils/constants";
import { useTheme } from "../../hooks/useTheme";
import { TimelineEntry } from "./TimelineEntry";
import type { Entry, Category, SessionStatus, CategoryId } from "../../types";

const ENTRIES_PER_PAGE = 20;

interface Position {
    x: number;
    y: number;
}

interface TimelineProps {
    entries: Entry[];
    allEntries?: Entry[];
    status: SessionStatus;
    categories: Category[];
    onContextMenu: (entry: Entry, position: Position) => void;
    categoryFilter?: CategoryId[];
    onNavigateToEntry?: (entry: Entry) => void;
    onDeleteAIComment?: (entry: Entry) => void;
}

export function Timeline({ entries, allEntries, status, categories, onContextMenu, categoryFilter = [], onNavigateToEntry, onDeleteAIComment }: TimelineProps) {
    const { theme } = useTheme();
    const [currentPage, setCurrentPage] = useState(0);
    const [showAIComments, setShowAIComments] = useState(true);

    // Reset page when entries change (filter changes)
    useEffect(() => {
        setCurrentPage(0);
    }, [categoryFilter.length]);

    const isFilterMode = categoryFilter.length > 0;
    const totalPages = isFilterMode ? Math.ceil(entries.length / ENTRIES_PER_PAGE) : 1;

    // In filter mode, paginate; otherwise show all
    const displayEntries = isFilterMode
        ? entries.slice(currentPage * ENTRIES_PER_PAGE, (currentPage + 1) * ENTRIES_PER_PAGE)
        : entries;

    const sortedEntries = isFilterMode
        ? displayEntries // Already sorted in App.jsx
        : [...displayEntries].sort((a, b) => a.timestamp - b.timestamp);

    // Build session durations map
    // For cross-date sessions, we need to look in allEntries to find the SESSION_START
    const sessionDurations: Record<string, number> = {};
    let currentSessionStartId: string | null = null;

    // Calculate line states
    const entryLineStates: Record<string, string> = {};
    let inSession = false;

    // First, check if we're already in a session from a previous day
    // by looking for an unclosed SESSION_START before today's first entry
    const allSorted = allEntries ? [...allEntries].sort((a, b) => a.timestamp - b.timestamp) : [];
    const firstDisplayedTimestamp = sortedEntries[0]?.timestamp ?? Date.now();

    for (const entry of allSorted) {
        if (entry.timestamp >= firstDisplayedTimestamp) break;
        if (entry.type === ENTRY_TYPES.SESSION_START) {
            currentSessionStartId = entry.id;
            inSession = true;
        } else if (entry.type === ENTRY_TYPES.SESSION_END) {
            currentSessionStartId = null;
            inSession = false;
        }
    }

    for (const entry of sortedEntries) {
        if (entry.type === ENTRY_TYPES.SESSION_START) {
            currentSessionStartId = entry.id;
        } else if (
            entry.type === ENTRY_TYPES.SESSION_END &&
            currentSessionStartId
        ) {
            // Store duration on the SESSION_START entry
            sessionDurations[currentSessionStartId] = entry.duration || 0;
            currentSessionStartId = null;
        }

        let state = "default";
        if (entry.type === ENTRY_TYPES.SESSION_START) {
            inSession = true;
            state = "start";
        } else if (entry.type === ENTRY_TYPES.SESSION_END) {
            // For cross-date SESSION_END, still show duration
            if (entry.duration && !sessionDurations[entry.id]) {
                // Store on the SESSION_END itself so TimelineEntry can find it
                sessionDurations[entry.id] = entry.duration;
            }
            inSession = false;
            state = "end";
        } else if (inSession) {
            state = "active";
        }
        entryLineStates[entry.id] = state;
    }

    return (
        <div
            className="timeline-container"
            style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px 16px 160px",
                fontFamily: "var(--font-mono)",
            }}
        >
            {/* AI Comment Toggle - top right */}
            <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: 12,
            }}>
                <button
                    onClick={() => setShowAIComments(!showAIComments)}
                    title={showAIComments ? "Hide AI Comments" : "Show AI Comments"}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontFamily: 'var(--font-mono)',
                        color: showAIComments ? 'var(--accent)' : 'var(--text-dim)',
                        backgroundColor: showAIComments ? 'var(--bg-secondary)' : 'transparent',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                    }}
                >
                    <MessageSquare size={14} />
                    <span>{showAIComments ? 'AI ON' : 'AI OFF'}</span>
                </button>
            </div>

            {/* Filter mode header with pagination */}
            {isFilterMode && entries.length > 0 && (
                <div
                    className="flex-between"
                    style={{
                        marginBottom: 16,
                        padding: "8px 12px",
                        backgroundColor: "var(--bg-secondary)",
                        borderRadius: 4,
                        fontSize: 11,
                        color: "var(--text-dim)",
                    }}
                >
                    <span>
                        Showing {entries.length} entries matching filter
                    </span>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                                disabled={currentPage === 0}
                                style={{
                                    padding: 4,
                                    backgroundColor: "transparent",
                                    border: "none",
                                    cursor: currentPage === 0 ? "default" : "pointer",
                                    color: currentPage === 0 ? "var(--text-dim)" : "var(--text-secondary)",
                                    opacity: currentPage === 0 ? 0.3 : 1,
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span style={{ fontSize: 10 }}>
                                {currentPage + 1} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                                disabled={currentPage === totalPages - 1}
                                style={{
                                    padding: 4,
                                    backgroundColor: "transparent",
                                    border: "none",
                                    cursor: currentPage === totalPages - 1 ? "default" : "pointer",
                                    color: currentPage === totalPages - 1 ? "var(--text-dim)" : "var(--text-secondary)",
                                    opacity: currentPage === totalPages - 1 ? 0.3 : 1,
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {entries.length === 0 && (
                <div
                    className="flex flex-col items-center justify-center"
                    style={{
                        height: 256,
                        color: "var(--text-muted)",
                        textAlign: "center",
                        opacity: 0.5,
                    }}
                >
                    <div style={{ fontSize: 32, marginBottom: 16 }}>_</div>
                    <p style={{ fontSize: 14 }}>
                        {isFilterMode ? "No entries match filter." : "System initialized."}
                    </p>
                    <p style={{ fontSize: 12, marginTop: 8 }}>
                        {isFilterMode ? "Try selecting different categories." : "Waiting for input..."}
                    </p>
                </div>
            )}

            {sortedEntries.map((entry, index) => (
                <TimelineEntry
                    key={entry.id}
                    entry={entry}
                    allEntries={allEntries || entries}
                    isFirst={index === 0}
                    isLast={index === sortedEntries.length - 1}
                    sessionDuration={sessionDurations[entry.id]}
                    categories={categories}
                    onContextMenu={onContextMenu}
                    lineState={entryLineStates[entry.id]}
                    isLightMode={theme.mode === "light"}
                    showDate={isFilterMode}
                    onNavigateToEntry={onNavigateToEntry}
                    showAIComments={showAIComments}
                    onDeleteAIComment={onDeleteAIComment}
                />
            ))}
        </div>
    );
}
