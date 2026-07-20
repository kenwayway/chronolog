import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ENTRY_TYPES } from "@/utils/constants";
import { sessionDurationsByStartId } from "@/utils/sessionPairing";
import { useTheme } from "@/hooks/useTheme";
import { useSessionContext } from "@/contexts/SessionContext";
import { TimelineEntry } from "./TimelineEntry";
import type { Entry, SessionStatus, CategoryId } from "@/types";

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
  categoryFilter?: CategoryId[];
  isFilterMode?: boolean;
  filterKey?: string;
  onNavigateToEntry?: (entry: Entry) => void;
}

export function Timeline({ entries, onContextMenu, onEdit, categoryFilter = [], isFilterMode: isFilterModeProp, filterKey = '', onNavigateToEntry }: TimelineProps) {
  const { state: { entries: allEntries, mediaItems }, categories } = useSessionContext();
  const { theme } = useTheme();

  // Stable key for categoryFilter to avoid re-creating strings on every render
  const categoryFilterKey = categoryFilter.join(',');
  const paginationKey = `${isFilterModeProp ?? 'auto'}:${categoryFilterKey}:${filterKey}`;
  const [pagination, setPagination] = useState({ key: paginationKey, page: 0 });
  const currentPage = pagination.key === paginationKey ? pagination.page : 0;

  const isFilterMode = isFilterModeProp ?? categoryFilter.length > 0;
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
    // sessionId-aware pairing (timestamp-order fallback for legacy entries)
    const durations = sessionDurationsByStartId(sortedEntries);
    const lineStates: Record<string, string> = {};
    let inSession = false;

    for (const entry of sortedEntries) {
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
                onClick={() => setPagination({ key: paginationKey, page: Math.max(0, currentPage - 1) })}
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
                onClick={() => setPagination({ key: paginationKey, page: Math.min(totalPages - 1, currentPage + 1) })}
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
          lineState={entryLineStates[entry.id]}
          isLightMode={theme.mode === "light"}
          showDate={isFilterMode}
          onNavigateToEntry={onNavigateToEntry}
          mediaItems={mediaItems}
        />
      ))}
    </div>
  );
}
