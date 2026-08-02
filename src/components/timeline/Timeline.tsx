import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useSessionContext } from "@/contexts/SessionContext";
import { TimelineEntry } from "./TimelineEntry";
import { buildZaddyAnnotationGroups } from "./annotationGroups";
import { getTimelineLineState } from "./timelineLineState";
import type { ZaddyAnnotation } from "./annotationGroups";
import { isZaddyComment } from "@/utils/zaddyComment";
import type { TimelineItem, SessionStatus, CategoryId } from "@/types";

const ENTRIES_PER_PAGE = 20;

interface Position {
  x: number;
  y: number;
}

interface AnnotationCluster {
  key: string;
  annotations: ZaddyAnnotation[];
}

interface TimelineProps {
  entries: TimelineItem[];
  status: SessionStatus;
  onContextMenu: (entry: TimelineItem, position: Position) => void;
  onEdit?: (entry: TimelineItem) => void;
  editingCommentId?: string | null;
  onEditComment?: (comment: TimelineItem) => void;
  onSaveComment?: (comment: TimelineItem, content: string) => void;
  onCancelCommentEdit?: () => void;
  categoryFilter?: CategoryId[];
  isFilterMode?: boolean;
  filterKey?: string;
  onNavigateToEntry?: (entry: TimelineItem) => void;
}

export function Timeline({
  entries,
  onContextMenu,
  onEdit,
  editingCommentId,
  onEditComment,
  onSaveComment,
  onCancelCommentEdit,
  categoryFilter = [],
  isFilterMode: isFilterModeProp,
  filterKey = '',
  onNavigateToEntry,
}: TimelineProps) {
  const { state: { mediaItems, sessions }, linkIndex, commentIndex, categories } = useSessionContext();
  const { theme } = useTheme();

  // Stable key for categoryFilter to avoid re-creating strings on every render
  const categoryFilterKey = categoryFilter.join(',');
  const paginationKey = `${isFilterModeProp ?? 'auto'}:${categoryFilterKey}:${filterKey}`;
  const [pagination, setPagination] = useState({ key: paginationKey, page: 0 });
  const [expandedAnnotationClusters, setExpandedAnnotationClusters] = useState<Set<string>>(() => new Set());
  const currentPage = pagination.key === paginationKey ? pagination.page : 0;

  const isFilterMode = isFilterModeProp ?? categoryFilter.length > 0;
  const primaryEntries = useMemo(
    () => entries.filter(entry => entry.origin !== 'zaddy'),
    [entries],
  );
  // Comments render attached to their target, so they are neither primary
  // entries nor ambient annotations — they never occupy a row of their own.
  const zaddyEntries = useMemo(
    () => entries.filter(entry => entry.origin === 'zaddy' && !isZaddyComment(entry)),
    [entries],
  );
  const annotationGroups = useMemo(
    () => buildZaddyAnnotationGroups(zaddyEntries, isFilterMode),
    [zaddyEntries, isFilterMode],
  );
  const annotationCount = useMemo(
    () => annotationGroups.reduce(
      (count, group) => count + group.annotations.length,
      0,
    ),
    [annotationGroups],
  );
  const annotationClusters = useMemo<AnnotationCluster[]>(() => {
    const orderedPrimary = [...primaryEntries].sort((left, right) => left.timestamp - right.timestamp);
    const clusters = new Map<string, AnnotationCluster>();

    for (const group of annotationGroups) {
      for (const annotation of group.annotations) {
        const nextEntryIndex = orderedPrimary.findIndex(
          entry => entry.timestamp > annotation.entry.timestamp,
        );
        const insertionIndex = nextEntryIndex === -1 ? orderedPrimary.length : nextEntryIndex;
        const key = `${group.dateKey}:${insertionIndex}`;
        let cluster = clusters.get(key);
        if (!cluster) {
          cluster = { key, annotations: [] };
          clusters.set(key, cluster);
        }
        cluster.annotations.push(annotation);
      }
    }

    return [...clusters.values()]
      .map(cluster => ({
        ...cluster,
        annotations: cluster.annotations.sort(
          (left, right) => left.entry.timestamp - right.entry.timestamp,
        ),
      }))
      .sort(
        (left, right) =>
          left.annotations[0].entry.timestamp - right.annotations[0].entry.timestamp,
      );
  }, [annotationGroups, primaryEntries]);
  const visibleAnnotations = useMemo(
    () => annotationClusters.flatMap(cluster =>
      expandedAnnotationClusters.has(cluster.key)
        ? cluster.annotations.map(annotation => annotation.entry)
        : [cluster.annotations[0].entry]
    ),
    [annotationClusters, expandedAnnotationClusters],
  );
  const annotationControls = useMemo(() => {
    const controls = new Map<string, AnnotationCluster>();
    for (const cluster of annotationClusters) {
      controls.set(cluster.annotations[0].entry.id, cluster);
    }
    return controls;
  }, [annotationClusters]);
  const annotationEndContent = useMemo(() => {
    const content = new Map<string, string>();
    for (const group of annotationGroups) {
      for (const annotation of group.annotations) {
        if (annotation.entry.kind === 'session-start' && annotation.endEntry?.content) {
          content.set(annotation.entry.id, annotation.endEntry.content);
        }
      }
    }
    return content;
  }, [annotationGroups]);
  const visibleTimelineEntries = useMemo(
    () => [...primaryEntries, ...visibleAnnotations],
    [primaryEntries, visibleAnnotations],
  );
  const totalPages = isFilterMode ? Math.ceil(visibleTimelineEntries.length / ENTRIES_PER_PAGE) : 1;

  // Memoize sorted entries to avoid re-sorting on every render
  const sortedEntries = useMemo(() => {
    const ordered = [...visibleTimelineEntries].sort((left, right) =>
      isFilterMode
        ? right.timestamp - left.timestamp
        : left.timestamp - right.timestamp
    );
    return isFilterMode
      ? ordered.slice(currentPage * ENTRIES_PER_PAGE, (currentPage + 1) * ENTRIES_PER_PAGE)
      : ordered;
  }, [visibleTimelineEntries, isFilterMode, currentPage]);

  // Memoize session duration and line state calculations
  const { sessionDurations, entryLineStates } = useMemo(() => {
    const durations: Record<string, number> = {};
    for (const session of sessions) {
      if (session.endAt !== null) durations[`session:${session.id}:start`] = session.endAt - session.startAt;
    }
    const lineStates: Record<string, string> = {};

    for (const entry of sortedEntries) {
      lineStates[entry.id] = getTimelineLineState(
        entry,
        sessions,
      );
    }

    return { sessionDurations: durations, entryLineStates: lineStates };
  }, [sortedEntries, sessions]);

  const toggleAnnotationCluster = (clusterKey: string) => {
    setExpandedAnnotationClusters(current => {
      const next = new Set(current);
      if (next.has(clusterKey)) {
        next.delete(clusterKey);
      } else {
        next.add(clusterKey);
      }
      return next;
    });
  };

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
            Showing {primaryEntries.length} entries
            {annotationCount > 0 ? ` · ${annotationCount} zaddy annotations` : ''}
            {' '}matching filter
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

      {primaryEntries.length === 0 && zaddyEntries.length === 0 && (
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
        (() => {
          const annotationControl = annotationControls.get(entry.id);
          const isExpanded = annotationControl
            ? expandedAnnotationClusters.has(annotationControl.key)
            : false;

          return (
            <TimelineEntry
              key={entry.id}
              entry={entry}
              linkIndex={linkIndex}
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
              comments={
                entry.kind === 'session-end' ? undefined : commentIndex.get(entry.entityId)
              }
              editingCommentId={editingCommentId}
              onEditComment={onEditComment}
              onSaveComment={onSaveComment}
              onCancelCommentEdit={onCancelCommentEdit}
              annotationMode={entry.origin === 'zaddy'}
              annotationEndContent={annotationEndContent.get(entry.id)}
              annotationGroupCount={annotationControl?.annotations.length}
              annotationGroupExpanded={isExpanded}
              annotationGroupEntryIds={annotationControl?.annotations.map(
                annotation => annotation.entry.id,
              )}
              onToggleAnnotationGroup={
                annotationControl
                  ? () => toggleAnnotationCluster(annotationControl.key)
                  : undefined
              }
            />
          );
        })()
      ))}
    </div>
  );
}
