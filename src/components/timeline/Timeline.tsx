import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, MessageCircle, MessageCircleOff } from "lucide-react";
import { ENTRY_TYPES } from "../../utils/constants";
import { useTheme } from "../../hooks/useTheme";
import { useSessionContext } from "../../contexts/SessionContext";
import { TimelineEntry } from "./TimelineEntry";
import type { Entry, SessionStatus, CategoryId } from "../../types";

const ENTRIES_PER_PAGE = 20;

interface Position {
  x: number;
  y: number;
}

interface TimelineProps {
  entries: Entry[];
  status: SessionStatus;
  onContextMenu: (entry: Entry, position: Position) => void;
  onEdit?: (entry: Entry) => void;
  onDeleteAIComment?: (entry: Entry) => void;
  categoryFilter?: CategoryId[];
  onNavigateToEntry?: (entry: Entry) => void;
}

export function Timeline({ entries, status, onContextMenu, onEdit, onDeleteAIComment, categoryFilter = [], onNavigateToEntry }: TimelineProps) {
  const { state: { entries: allEntries, mediaItems }, categories } = useSessionContext();
  const { theme } = useTheme();
  const [currentPage, setCurrentPage] = useState(0);
  const [showAIComments, setShowAIComments] = useState(true);

  // Stable key for categoryFilter to avoid re-creating strings on every render
  const categoryFilterKey = categoryFilter.join(',');

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(0);
  }, [categoryFilterKey]);

  const isFilterMode = categoryFilter.length > 0;
  const totalPages = isFilterMode ? Math.ceil(entries.length / ENTRIES_PER_PAGE) : 1;

  // Memoize sorted entries to avoid re-sorting on every render
  const sortedEntries = useMemo(() => {
    const display = isFilterMode
      ? entries.slice(currentPage * ENTRIES_PER_PAGE, (currentPage + 1) * ENTRIES_PER_PAGE)
      : entries;

    return isFilterMode
      ? display // Already sorted in App.tsx
      : [...display].sort((a, b) => a.timestamp - b.timestamp);
  }, [entries, isFilterMode, currentPage]);

  // Memoize session duration and line state calculations
  const { sessionDurations, entryLineStates } = useMemo(() => {
    const durations: Record<string, number> = {};
    const lineStates: Record<string, string> = {};
    let startId: string | null = null;
    let startTime: number | null = null;
    let inSession = false;

    for (const entry of sortedEntries) {
      if (entry.type === ENTRY_TYPES.SESSION_START) {
        startId = entry.id;
        startTime = entry.timestamp;
      } else if (
        entry.type === ENTRY_TYPES.SESSION_END &&
        startId &&
        startTime
      ) {
        durations[startId] = entry.timestamp - startTime;
        startId = null;
        startTime = null;
      }

      let state = "default";
      if (entry.type === ENTRY_TYPES.SESSION_START) {
        inSession = true;
        state = "start";
      } else if (entry.type === ENTRY_TYPES.SESSION_END) {
        inSession = false;
        state = "end";
      } else if (inSession) {
        state = "active";
      }
      lineStates[entry.id] = state;
    }

    return { sessionDurations: durations, entryLineStates: lineStates };
  }, [sortedEntries]);

  return (
    <div
      className="timeline-container"
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px 16px 160px",
        fontFamily: "var(--font-mono)",
        position: "relative",
      }}
    >
      {/* AI Comment Toggle */}
      <button
        onClick={() => setShowAIComments(!showAIComments)}
        title={showAIComments ? "Hide AI Comments" : "Show AI Comments"}
        style={{
          position: "absolute",
          top: 8,
          right: 16,
          padding: 6,
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 4,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: showAIComments ? "var(--accent)" : "var(--text-dim)",
          opacity: showAIComments ? 1 : 0.5,
          zIndex: 10,
        }}
      >
        {showAIComments ? <MessageCircle size={16} /> : <MessageCircleOff size={16} />}
      </button>
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
          allEntries={allEntries}
          isFirst={index === 0}
          isLast={index === sortedEntries.length - 1}
          sessionDuration={sessionDurations[entry.id]}
          categories={categories}
          onContextMenu={onContextMenu}
          onEdit={onEdit}
          onDeleteAIComment={onDeleteAIComment}
          lineState={entryLineStates[entry.id]}
          isLightMode={theme.mode === "light"}
          showDate={isFilterMode}
          onNavigateToEntry={onNavigateToEntry}
          showAIComment={showAIComments}
          mediaItems={mediaItems}
        />
      ))}
    </div>
  );
}
